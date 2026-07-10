import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile.tsx";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";
import {
  useGetIntake,
  useSaveIntake,
  useGetIntakeScore,
  getGetIntakeQueryKey,
  getGetIntakeScoreQueryKey,
  getGetCampaignQueryKey,
} from "@workspace/api-client-react";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { globalSilentRefresh } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckCircle2, Loader2, Send, Database,
  MessageSquare, LayoutList, ChevronRight, Zap,
  Rocket, RefreshCw, Radio, TrendingUp, BarChart3,
  Users, Mail, Check, X, BarChart2, ChevronDown, ChevronUp, CornerDownLeft,
  Mic, MicOff, Paperclip, ImageIcon, File, FileAudio, FileVideo,
  Target, DollarSign, Calendar, Clock, Shield, Star, Bot, Flame, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import nexosLogo from "/nexos-logo.png";
import { BudgetSimulator } from "@/components/budget-simulator";

interface ChatFile {
  name: string;
  url: string;
  isImage: boolean;
  mimeType?: string;
  size?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  agentId?: string;
  files?: ChatFile[];
}

interface ConversationResult {
  agentId?: string;
  aiMessage: string;
  isComplete: boolean;
  progress: number;
  intakeData: Record<string, unknown>;
  proposedType: string | null;
  proposedTrack: string | null;
  proposedReason: string | null;
}

// ── Intake agents roster (mirrors backend INTAKE_AGENTS) ───────────────────────
const INTAKE_AGENTS: Record<string, { name: string; role: string; specialty: string; color: string; initial: string }> = {
  erico:  { name: "Érico",  role: "Estrategista de Produto",      specialty: "PLF · Fórmula de Lançamento",         color: "text-blue-400",    initial: "E" },
  ryan:   { name: "Ryan",   role: "Especialista em Audiência",    specialty: "Avatar · Psicologia do Comprador",     color: "text-emerald-400", initial: "R" },
  jeff:   { name: "Jeff",   role: "Estrategista de Receita",      specialty: "Metas · Orçamento · ROI",             color: "text-yellow-400",  initial: "J" },
  chet:   { name: "Chet",   role: "Diretor de Estratégia",        specialty: "Modelo de Campanha · Funil",           color: "text-violet-400",  initial: "C" },
  walker: { name: "Walker", role: "Especialista em Execução",     specialty: "PLF Avançado · Copy de Lançamento",   color: "text-orange-400",  initial: "W" },
};

// ── Campaign type/track label maps ─────────────────────────────────────────────
const TYPE_LABELS: Record<string, { label: string; tag: string; icon: React.ElementType; color: string }> = {
  launch:              { label: "Lançamento",      tag: "PLF / Fórmula",       icon: Rocket,     color: "text-blue-400" },
  perpetual_launch:    { label: "Perpétuo",         tag: "Evergreen",           icon: RefreshCw,  color: "text-emerald-400" },
  flash_sale:          { label: "Flash Sale",       tag: "24h a 72h",           icon: Zap,        color: "text-yellow-400" },
  live_sale:           { label: "Live Sale",        tag: "Vendas ao vivo",      icon: Radio,      color: "text-pink-400" },
  continuous_sales:    { label: "Contínuo",         tag: "Vendas diárias",      icon: TrendingUp, color: "text-cyan-400" },
  subscription_growth: { label: "Assinatura",       tag: "Clube / Membros",     icon: Mail,       color: "text-violet-400" },
  authority:           { label: "Autoridade",       tag: "Branding",            icon: BarChart3,  color: "text-orange-400" },
  audience_growth:     { label: "Crescimento",      tag: "Audiência orgânica",  icon: Users,      color: "text-teal-400" },
  affiliate:           { label: "Afiliado",         tag: "Produto de terceiros", icon: Users,     color: "text-lime-400" },
};

const TRACK_LABELS: Record<string, { label: string; range: string; color: string }> = {
  six_digits:      { label: "6 Dígitos",   range: "R$ 100k – 999k em 7 dias",             color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
  eight_digits:    { label: "8 Dígitos",   range: "R$ 10M – 99M em 7 dias",               color: "text-violet-400 border-violet-400/40 bg-violet-400/10" },
  ten_digits:      { label: "10 Dígitos",  range: "R$ 100M+ em 7 dias",                    color: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
  not_applicable:  { label: "Crescimento", range: "Sem meta de faturamento concentrado",   color: "text-teal-400 border-teal-400/40 bg-teal-400/10" },
};

function AgentAvatar({ agentId, size = "sm" }: { agentId?: string; size?: "sm" | "md" }) {
  const agent = agentId ? INTAKE_AGENTS[agentId] : null;
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const txt = size === "sm" ? "text-xs" : "text-sm";
  if (!agent) {
    return (
      <div className={`${dim} rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0`}>
        <img src={nexosLogo} alt="AI" className="w-4 h-4 object-contain" />
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-sm border bg-card/80 flex items-center justify-center shrink-0 font-mono font-black ${txt} ${agent.color} border-current/30`}>
      {agent.initial}
    </div>
  );
}

function ChatBubble({ msg, showAgentLabel }: { msg: ChatMessage; showAgentLabel?: boolean }) {
  const isUser = msg.role === "user";
  const agent = (!isUser && msg.agentId) ? INTAKE_AGENTS[msg.agentId] : null;

  return (
    <div className={`flex gap-2 md:gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && <AgentAvatar agentId={msg.agentId} size="sm" />}
      <div className={`flex flex-col gap-1.5 max-w-[88%] ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && agent && showAgentLabel && (
          <div className="flex items-center gap-2 px-1">
            <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${agent.color}`}>{agent.name}</span>
            <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider">{agent.role}</span>
          </div>
        )}

        {/* File attachments — clickable cards/thumbnails */}
        {msg.files && msg.files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {msg.files.map((f, fi) => f.isImage ? (
              <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                className="block relative rounded-lg overflow-hidden border border-border/50 hover:opacity-90 transition-opacity"
                title={f.name}>
                <img src={f.url} alt={f.name} className="h-28 w-28 object-cover" />
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] font-mono truncate text-white/70"
                  style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
                  {f.name}
                </div>
              </a>
            ) : (
              <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors px-3 py-2 max-w-[200px]"
                title={`Abrir ${f.name}`}>
                <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: f.mimeType === "application/pdf" ? "hsl(0 50% 12%)" : "hsl(220 30% 14%)" }}>
                  <File className={`h-4 w-4 ${f.mimeType === "application/pdf" ? "text-red-400" : "text-blue-400"}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-medium text-foreground truncate leading-tight">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {f.size ? (f.size >= 1_000_000 ? `${(f.size / 1_000_000).toFixed(1)} MB` : `${Math.round(f.size / 1_000)} KB`) : "Abrir ↗"}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        {msg.content && (
          <div className={`px-3 md:px-4 py-2.5 md:py-3 rounded-sm text-xs md:text-sm font-mono leading-relaxed whitespace-pre-wrap
            ${isUser
              ? "bg-primary/20 border border-primary/30 text-foreground ml-auto"
              : "bg-card/80 border border-border/50 text-foreground"
            }`}
          >
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Type Proposal Card ─────────────────────────────────────────────────────────
function TypeProposalCard({
  proposedType,
  proposedTrack,
  proposedReason,
  onConfirm,
  onReject,
  confirming,
}: {
  proposedType: string;
  proposedTrack: string;
  proposedReason: string | null;
  onConfirm: () => void;
  onReject: () => void;
  confirming: boolean;
}) {
  const typeInfo = TYPE_LABELS[proposedType];
  const trackInfo = TRACK_LABELS[proposedTrack];
  if (!typeInfo || !trackInfo) return null;
  const Icon = typeInfo.icon;

  return (
    <div className="border border-primary/40 bg-primary/5 p-4 rounded-sm animate-in slide-in-from-bottom-3 duration-300 relative">
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/50" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/50" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary/50" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary/50" />

      <div className="font-mono text-[10px] uppercase tracking-widest text-primary/60 mb-3">
        Modelo Recomendado pelo agente
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 border border-current/30 bg-current/5 flex items-center justify-center shrink-0 ${typeInfo.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className={`font-mono font-bold text-base uppercase tracking-tighter ${typeInfo.color}`}>
            {typeInfo.label}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
            {typeInfo.tag}
          </div>
          <div className="font-mono text-xs text-muted-foreground/80 mt-1">
            Trilha: <span className="text-foreground font-bold">{trackInfo.label}</span>
            <span className="text-muted-foreground/50 ml-1">({trackInfo.range})</span>
          </div>
        </div>
      </div>

      {proposedReason && (
        <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed mb-4 border-t border-border/30 pt-3">
          {proposedReason}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 rounded-none font-mono uppercase tracking-widest h-10 gap-2 btn-weapon-primary text-xs"
        >
          {confirming
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Confirmando...</>
            : <><Check className="h-3.5 w-3.5" />Confirmar esse modelo</>
          }
        </Button>
        <Button
          onClick={onReject}
          disabled={confirming}
          variant="outline"
          className="rounded-none font-mono uppercase tracking-widest h-10 px-4 gap-2 text-xs border-border/50"
        >
          <X className="h-3.5 w-3.5" />Quero outro
        </Button>
      </div>
    </div>
  );
}

// ── Launch model labels ─────────────────────────────────────────────────────
const MODEL_LABELS: Record<string, string> = {
  plf: "PLF — Product Launch Formula",
  formula_de_lancamento: "Fórmula de Lançamento",
  semente: "Lançamento Semente",
  afiliado: "Lançamento de Afiliado",
  perpetual: "Perpétuo / Evergreen",
  custom: "Personalizado",
};

const TIMELINE_PHASES = [
  { day: "D-7 → D-5", phase: "Aquecimento",   desc: "Autoridade · Antecipação · Audiência aquecida",  icon: Flame,    color: "text-orange-400" },
  { day: "D-4 → D-2", phase: "Valor",          desc: "Conteúdo premium · Prova social · Reciprocidade", icon: Star,     color: "text-yellow-400" },
  { day: "D-1",        phase: "Abertura",       desc: "Aviso 24h · Email + WhatsApp simultâneos",        icon: Rocket,   color: "text-primary" },
  { day: "D0 → D3",   phase: "Carrinho Aberto", desc: "Depoimentos · Objeções · Urgência crescente",    icon: Target,   color: "text-green-400" },
  { day: "D4 → D5",   phase: "Escassez",        desc: "Contagem regressiva · Vagas limitadas",           icon: Clock,    color: "text-red-400" },
  { day: "D6 → D7",   phase: "Fechamento",      desc: "Último aviso · Encerramento · Conversão final",  icon: Trophy,   color: "text-amber-400" },
];

const EXEC_AGENTS = [
  { role: "Comando",           provider: "Claude",  specialty: "Orquestra toda a execução" },
  { role: "Estrategista",      provider: "Claude",  specialty: "Plano de lançamento detalhado" },
  { role: "Copywriter",        provider: "GPT-4o",  specialty: "Textos persuasivos por plataforma" },
  { role: "Analista de Público",provider: "Gemini", specialty: "Segmentação e personas" },
  { role: "Gestor de Tráfego", provider: "Gemini",  specialty: "Plano de mídia paga" },
  { role: "Compliance",        provider: "Claude",  specialty: "LGPD · CVM · padrões éticos" },
];

function MasterPlanView({
  formData,
  onApprove,
  onBack,
  finalizing,
}: {
  formData: Record<string, string>;
  onApprove: () => Promise<void>;
  onBack: () => void;
  finalizing: boolean;
}) {
  const productName   = formData["product.name"]  || formData["product.nome"]  || "Produto";
  const rawPrice      = Number(formData["product.price"] || formData["product.preco"] || 0);
  const audience      = formData["audience.avatar"] || formData["audience.target"] || formData["audience.primaryPersona"] || "Definido no briefing";
  const rawBudget     = Number(formData["campaign.budget.total"] || formData["campaign.budget"] || 0);
  const rawRevenue    = Number(formData["campaign.revenueTarget"] || 0);
  const launchModel   = formData["campaign.model"] || formData["launch.model"] || formData["campaign.type"] || "plf";
  const transformation= formData["product.transformation"] || formData["product.promise"] || "";
  const rawDuration   = Number(formData["launch.duration"] || 7);
  const trackKey      = formData["campaign.track"] || formData["launch.track"] || "six_digits";
  const track         = TRACK_LABELS[trackKey] ?? TRACK_LABELS["six_digits"];
  const modelLabel    = MODEL_LABELS[launchModel] ?? launchModel;

  const fmtBRL = (v: number) =>
    v > 0 ? `R$${v.toLocaleString("pt-BR")}` : "—";

  // Estimated sales count
  const estSales = rawPrice > 0 && rawRevenue > 0 ? Math.ceil(rawRevenue / rawPrice) : null;

  return (
    <div className="flex flex-col min-h-screen max-w-5xl mx-auto w-full gap-0">
      {/* ── Top bar ── */}
      <div className="border-b border-border/50 pb-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" />Voltar ao Briefing
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-black text-foreground">
                Master Plan do Lançamento
              </h1>
            </div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Revise o plano gerado pela inteligência NexOS · Aprove para iniciar os agentes
            </p>
          </div>
          <Badge
            variant="outline"
            className={`rounded-none font-mono text-sm px-4 py-1.5 font-bold self-start md:self-auto ${track.color}`}
          >
            {track.label}
          </Badge>
        </div>
      </div>

      {/* ── Summary grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Target,      label: "Meta de Receita",  value: fmtBRL(rawRevenue),            sub: estSales ? `≈ ${estSales} vendas` : undefined },
          { icon: DollarSign,  label: "Preço do Produto", value: fmtBRL(rawPrice),               sub: "ticket unitário" },
          { icon: BarChart3,   label: "Budget de Tráfego",value: rawBudget > 0 ? fmtBRL(rawBudget) : "A definir", sub: rawRevenue > 0 && rawBudget > 0 ? `ROAS alvo: ${(rawRevenue / rawBudget).toFixed(1)}x` : undefined },
          { icon: Calendar,    label: "Duração",          value: `${rawDuration} dias`,          sub: modelLabel },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="border border-border/40 bg-card/40 p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
            </div>
            <span className="font-mono text-lg font-black text-foreground">{value}</span>
            {sub && <span className="font-mono text-[10px] text-muted-foreground/60">{sub}</span>}
          </div>
        ))}
      </div>

      {/* ── Produto + Público ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="border border-border/40 bg-card/40 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Produto</span>
          </div>
          <p className="font-mono text-base font-bold text-foreground">{productName}</p>
          {transformation && (
            <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed italic">"{transformation}"</p>
          )}
          <div className="pt-2 border-t border-border/30">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Modelo de Lançamento</span>
            <p className="font-mono text-sm font-semibold text-primary mt-0.5">{modelLabel}</p>
          </div>
        </div>
        <div className="border border-border/40 bg-card/40 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Público-Alvo</span>
          </div>
          <p className="font-mono text-sm text-foreground/90 leading-relaxed">{audience}</p>
          <div className="pt-2 border-t border-border/30">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Track</span>
            <p className={`font-mono text-sm font-bold mt-0.5 ${track.color.split(" ")[0]}`}>{track.label} · {track.range}</p>
          </div>
        </div>
      </div>

      {/* ── Linha do tempo ── */}
      <div className="border border-border/40 bg-card/30 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Linha do Tempo de Execução</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TIMELINE_PHASES.map(({ day, phase, desc, icon: Icon, color }) => (
            <div key={day} className="border border-border/30 bg-background/40 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${color}`}>{day}</span>
              </div>
              <p className="font-mono text-xs font-bold text-foreground">{phase}</p>
              <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agentes que vão executar ── */}
      <div className="border border-border/40 bg-card/30 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Agentes de IA Alocados</span>
          <Badge variant="outline" className="rounded-none font-mono text-[10px] px-2 py-0 border-primary/30 text-primary">
            {EXEC_AGENTS.length} agentes
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {EXEC_AGENTS.map(({ role, provider, specialty }) => (
            <div key={role} className="border border-border/30 bg-background/30 p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-foreground">{role}</span>
                <Badge variant="outline" className="rounded-none font-mono text-[9px] px-1.5 py-0 border-primary/20 text-primary/80">{provider}</Badge>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground/70">{specialty}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gatilhos mentais ── */}
      <div className="border border-border/40 bg-card/30 p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Gatilhos Mentais do Plano</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Autoridade", "Prova Social", "Antecipação", "Escassez", "Urgência", "Reciprocidade", "Comunidade", "Transformação"].map((g) => (
            <span key={g} className="border border-border/40 bg-muted/20 px-3 py-1.5 font-mono text-[11px] text-foreground/80 uppercase tracking-wide">
              {g}
            </span>
          ))}
        </div>
      </div>

      {/* ── CTA de aprovação ── */}
      <div className="border border-primary/30 bg-primary/5 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-bold text-foreground">
            Plano completo · {EXEC_AGENTS.length} agentes prontos para execução
          </p>
          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
            Ao aprovar, os agentes iniciam imediatamente — estratégia, conteúdo e calendário editorial
          </p>
        </div>
        <Button
          onClick={() => void onApprove()}
          disabled={finalizing}
          className="font-mono uppercase tracking-widest rounded-none gap-2 h-14 px-8 text-sm btn-weapon-primary whitespace-nowrap shrink-0"
        >
          {finalizing
            ? <><Loader2 className="h-5 w-5 animate-spin" />Iniciando Agentes...</>
            : <><Rocket className="h-5 w-5" />Aprovar e Iniciar Agentes<ChevronRight className="h-5 w-5" /></>
          }
        </Button>
      </div>

      <div className="h-8" />
    </div>
  );
}

export default function CampaignIntake() {
  const [, params] = useRoute("/campaigns/:id/intake");
  const campaignId = params?.id || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const draftKey = `nexos_intake_draft_${campaignId}`;

  const [view, setView] = useState<"chat" | "form">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState(() => {
    try { return localStorage.getItem(`nexos_intake_draft_${campaignId}`) ?? ""; }
    catch { return ""; }
  });
  const [sending, setSending] = useState(false);
  const [chatComplete, setChatComplete] = useState(() => {
    try { return localStorage.getItem(`nexos:chatComplete:${campaignId}`) === "1"; }
    catch { return false; }
  });
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [answeredRequired, setAnsweredRequired] = useState(0);
  const [totalRequired, setTotalRequired] = useState(0);

  // Pending type proposal from AI
  const [pendingProposal, setPendingProposal] = useState<{
    type: string;
    track: string;
    reason: string | null;
  } | null>(null);
  const [confirmingType, setConfirmingType] = useState(false);

  // Budget simulator panel
  const [showSimulator, setShowSimulator] = useState(false);

  // Master Plan view — shown after chat completes, before calling finalize
  const [showMasterPlan, setShowMasterPlan] = useState(false);

  // Persist draft to localStorage as user types — survives any page reload
  useEffect(() => {
    try {
      if (inputValue) localStorage.setItem(draftKey, inputValue);
      else localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
  }, [inputValue, draftKey]);

  const [isListening, setIsListening]           = useState(false);
  const [isTranscribing, setIsTranscribing]     = useState(false);
  const [pendingFiles, setPendingFiles]         = useState<Array<{ name: string; content?: string; url: string; isImage: boolean; isAudioVideo?: boolean; size?: number; mimeType?: string }>>([]);
  const aiTriggered = useRef(false);
  const sendingRef = useRef(false);
  const progressHydratedRef = useRef(false);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const audioInputRef   = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const { data, isLoading } = useGetIntake(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetIntakeQueryKey(campaignId) },
  });

  const { data: scoreData } = useGetIntakeScore(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetIntakeScoreQueryKey(campaignId) },
  });

  const saveMutation = useSaveIntake({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
        toast.success("Dados salvos.");
      },
      onError: () => toast.error("Erro ao salvar."),
    },
  });

  // Track if user is returning to an in-progress intake
  const [isReturning, setIsReturning] = useState(false);

  // Load existing intake data + restore conversation history.
  // IMPORTANT: this effect re-runs on every query invalidation/refetch (which
  // happens after every chat turn). Once the user has started chatting, the
  // in-flight response payload (handleSend/autoTrigger/etc.) is the freshest
  // source of truth for progress/answeredRequired/totalRequired — a refetch
  // that lands mid-flight (or before the backend has fully committed the new
  // state) must NOT overwrite it with stale numbers. So we only hydrate these
  // fields from `data` once, on the very first load / page refresh.
  useEffect(() => {
    if (!data?.intakeData) return;
    setFormData(data.intakeData as Record<string, string>);

    if (!progressHydratedRef.current) {
      progressHydratedRef.current = true;
      const comp = data.completeness;
      const compObj = typeof comp === "object" && comp !== null ? comp as { progress?: number; answeredRequired?: number; totalRequired?: number } : null;
      setProgress(typeof comp === "number" ? comp : compObj?.progress ?? 0);
      if (compObj?.answeredRequired != null) setAnsweredRequired(compObj.answeredRequired);
      if (compObj?.totalRequired != null) setTotalRequired(compObj.totalRequired);

      // Restore saved conversation history from the DB
      const raw = data.intakeData as Record<string, unknown>;
      const savedHistory = raw._conversationHistory;
      const filledKeys = Object.keys(raw).filter(k => !k.startsWith("_") && raw[k]);
      if (Array.isArray(savedHistory) && savedHistory.length > 0) {
        setMessages(savedHistory as ChatMessage[]);
        aiTriggered.current = true; // history exists — don't fire auto-trigger greeting
        setIsReturning(true);
      } else if (filledKeys.length > 0) {
        // Has data but no history — auto-trigger will fire continuar_intake, mark as returning
        setIsReturning(true);
      }
    }
  }, [data]);

  // ── Helper: call conversation endpoint with auto-refresh on 401 ──────────────
  const callConversation = async (body: object): Promise<ConversationResult> => {
    const doFetch = () => customFetch<ConversationResult>(
      `/api/intake/${campaignId}/conversation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    try {
      return await doFetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const refreshed = await globalSilentRefresh();
        if (refreshed) return await doFetch();
      }
      throw err;
    }
  };

  // ── AI AUTO-TRIGGER on fresh campaign ─────────────────────────────────────────
  useEffect(() => {
    if (isLoading || !campaignId || aiTriggered.current) return;
    aiTriggered.current = true;

    const intakeD = (data?.intakeData ?? {}) as Record<string, unknown>;
    const filledKeys = Object.keys(intakeD).filter(k => !k.startsWith("_"));

    const autoTrigger = async () => {
      sendingRef.current = true;
      setSending(true);
      // Hard timeout: if AI takes >25s, unblock the input with a fallback greeting
      const timeoutId = setTimeout(() => {
        sendingRef.current = false;
        setSending(false);
        setMessages(prev => prev.length === 0 ? [{
          role: "assistant" as const,
          content: "Oi! Aqui é o especialista de briefing do NexOS. 👋\n\nVou fazer algumas perguntas simples sobre o seu produto para montar o plano de lançamento — não precisa ser técnico, pode responder com suas próprias palavras.\n\nPrimeira pergunta: qual é o nome do seu produto e o que ele ensina ou entrega para quem compra?",
        }] : prev);
        setTimeout(() => inputRef.current?.focus(), 200);
      }, 25_000);
      try {
        const result = await callConversation({
          message: filledKeys.length > 0 ? "continuar_intake" : "iniciar_intake",
          history: [],
        });
        clearTimeout(timeoutId);
        setMessages([{ role: "assistant", content: result.aiMessage, agentId: result.agentId }]);
        if (result.intakeData) setFormData(result.intakeData as Record<string, string>);
        if (result.progress) setProgress(prev => Math.max(prev, result.progress ?? 0));
        const r0 = result as unknown as { answeredRequired?: number; totalRequired?: number };
        if (r0.answeredRequired != null) setAnsweredRequired(prev => Math.max(prev, r0.answeredRequired ?? 0));
        if (r0.totalRequired != null) setTotalRequired(r0.totalRequired);
        if (result.isComplete) { setChatComplete(true); try { localStorage.setItem(`nexos:chatComplete:${campaignId}`, "1"); } catch { /* ignore */ } }
        if (result.proposedType && result.proposedTrack) {
          setPendingProposal({ type: result.proposedType, track: result.proposedTrack, reason: result.proposedReason });
        }
        queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
      } catch {
        clearTimeout(timeoutId);
        setMessages([{
          role: "assistant" as const,
          content: "Oi! Aqui é o especialista de briefing do NexOS. 👋\n\nVou fazer algumas perguntas simples sobre o seu produto para montar o plano de lançamento — não precisa ser técnico, pode responder com suas próprias palavras.\n\nPrimeira pergunta: qual é o nome do seu produto e o que ele ensina ou entrega para quem compra?",
        }]);
      } finally {
        clearTimeout(timeoutId);
        sendingRef.current = false;
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    };

    void autoTrigger();
  }, [isLoading, campaignId, data]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, pendingProposal]);

  // ── Confirm proposed type ─────────────────────────────────────────────────────
  const handleConfirmType = async () => {
    if (!pendingProposal) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    setConfirmingType(true);
    try {
      await customFetch(`/api/intake/${campaignId}/confirm-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: pendingProposal.type, track: pendingProposal.track }),
      });
      setPendingProposal(null);
      queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });

      // Continue conversation with confirmation
      setSending(true);
      const result = await callConversation({
        message: `Confirmo o modelo: ${pendingProposal.type} na trilha ${pendingProposal.track}`,
        history: messages.map(m => ({ role: m.role, content: m.content })).slice(-12),
      });
      setMessages(prev => [...prev, { role: "assistant", content: result.aiMessage, agentId: result.agentId }]);
      if (result.intakeData) setFormData(result.intakeData as Record<string, string>);
      if (result.progress != null) setProgress(prev => Math.max(prev, result.progress ?? 0));
      const r1 = result as unknown as { answeredRequired?: number; totalRequired?: number };
      if (r1.answeredRequired != null) setAnsweredRequired(prev => Math.max(prev, r1.answeredRequired ?? 0));
      if (r1.totalRequired != null) setTotalRequired(r1.totalRequired);
      if (result.isComplete) { setChatComplete(true); try { localStorage.setItem(`nexos:chatComplete:${campaignId}`, "1"); } catch { /* ignore */ } }
    } catch {
      toast.error("Erro ao confirmar modelo. Tente novamente.");
    } finally {
      sendingRef.current = false;
      setConfirmingType(false);
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  const handleRejectType = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setPendingProposal(null);
    setSending(true);
    try {
      const result = await callConversation({
        message: "Quero considerar outras opções de modelo de campanha. Pode me explicar as alternativas que fariam sentido para o meu caso?",
        history: messages.map(m => ({ role: m.role, content: m.content })).slice(-12),
      });
      setMessages(prev => [...prev, { role: "assistant", content: result.aiMessage, agentId: result.agentId }]);
      if (result.proposedType && result.proposedTrack) {
        setPendingProposal({ type: result.proposedType, track: result.proposedTrack, reason: result.proposedReason });
      }
    } catch {
      toast.error("Erro. Tente novamente.");
    } finally {
      sendingRef.current = false;
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  // ── Voice to text ─────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { toast.error("Seu navegador não suporta voz. Use Chrome ou Edge."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    const rec = new SpeechRec() as any;
    rec.lang = "pt-BR"; rec.continuous = false; rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const t = (e.results[0]?.[0]?.transcript as string | undefined) ?? "";
      if (t) setInputValue(prev => prev ? `${prev} ${t}` : t);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => { setIsListening(false); toast.error("Erro ao capturar áudio. Verifique as permissões do microfone."); };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    toast("Ouvindo… fale agora.", { duration: 2500 });
  };

  // ── File select (text / images / docs) ───────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const added = await Promise.all(files.map(async f => {
      const isReadable = f.type.startsWith("text/") ||
        ["application/json"].includes(f.type) ||
        /\.(txt|md|csv|json|ts|tsx|js|jsx|py|sql)$/i.test(f.name);
      let content: string | undefined;
      if (isReadable && f.size < 400_000) {
        content = await new Promise<string>(res => {
          const r = new FileReader();
          r.onload = ev => res((ev.target?.result as string) ?? "");
          r.onerror = () => res("");
          r.readAsText(f);
        });
      }
      return { name: f.name, content, url: URL.createObjectURL(f), isImage: f.type.startsWith("image/"), size: f.size, mimeType: f.type };
    }));
    setPendingFiles(prev => [...prev, ...added]);
    e.target.value = "";
  };

  // ── Audio / video select → Whisper transcription ──────────────────────────────
  const handleAudioVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");
    if (!isAudio && !isVideo) {
      toast.error("Use um arquivo de áudio ou vídeo.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 100 MB).");
      return;
    }

    setIsTranscribing(true);
    const toastId = toast.loading(
      isAudio ? "Transcrevendo áudio via transcrição…" : "Extraindo e transcrevendo áudio do vídeo…",
      { duration: Infinity },
    );

    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await customFetch<{ transcript: string }>(
        `/api/intake/${campaignId}/transcribe`,
        { method: "POST", body: formData },
      );

      toast.dismiss(toastId);
      if (!resp.transcript) {
        toast.error("Nenhuma fala detectada no arquivo. Verifique o áudio e tente novamente.");
        return;
      }

      // Inject transcript into the textarea so user can review before sending
      setInputValue(prev => prev ? `${prev}\n\n${resp.transcript}` : resp.transcript);
      toast.success(
        `Transcrição concluída — ${resp.transcript.length} caracteres extraídos. Revise e envie.`,
        { duration: 5000 },
      );
      setTimeout(() => inputRef.current?.focus(), 200);
    } catch (err) {
      toast.dismiss(toastId);
      const msg = err instanceof Error ? err.message : "Erro ao transcrever arquivo.";
      toast.error(msg, { duration: 7000 });
    } finally {
      setIsTranscribing(false);
    }
  };

  const removeFile = (idx: number) => {
    setPendingFiles(prev => { URL.revokeObjectURL(prev[idx]?.url ?? ""); return prev.filter((_, i) => i !== idx); });
  };

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() && pendingFiles.length === 0) return;
    // `sending` state is a stale closure across near-simultaneous invocations
    // (e.g. Enter mashed twice before React commits the re-render) — a plain
    // `if (sending) return` can let both calls through. Use a synchronous ref
    // as the real guard; `sending` state remains only for UI disabling.
    if (sendingRef.current) return;
    sendingRef.current = true;
    const userMsg = inputValue.trim();
    const filesSnapshot = pendingFiles;
    setPendingFiles([]);

    // Build display message (text only — files rendered separately as cards)
    const displayMsg = userMsg || "";

    // Build AI message (includes readable file contents)
    const fileContext = filesSnapshot.filter(f => f.content)
      .map(f => `\n\n--- Arquivo: ${f.name} ---\n${f.content}`).join("");
    const aiMsg = (userMsg || "(Veja os arquivos abaixo)") + fileContext;

    // Store file metadata with message so they remain clickable in history
    const msgFiles: ChatFile[] = filesSnapshot.map(f => ({
      name: f.name, url: f.url, isImage: f.isImage, mimeType: f.mimeType, size: f.size,
    }));

    // Clear the textarea immediately (optimistic) — the message is already
    // committed to the chat history below. If the request fails we restore
    // the text in the catch block so nothing is lost.
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: displayMsg, files: msgFiles.length > 0 ? msgFiles : undefined }];
    setMessages(newMessages);
    setInputValue("");
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setSending(true);
    setPendingProposal(null);

    try {
      const history = newMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const result = await callConversation({ message: aiMsg, history });

      setMessages((prev) => [...prev, { role: "assistant", content: result.aiMessage, agentId: result.agentId }]);
      if (result.intakeData) setFormData(result.intakeData as Record<string, string>);
      if (result.progress != null) setProgress(prev => Math.max(prev, result.progress ?? 0));
      const r2 = result as unknown as { answeredRequired?: number; totalRequired?: number };
      if (r2.answeredRequired != null) setAnsweredRequired(prev => Math.max(prev, r2.answeredRequired ?? 0));
      if (r2.totalRequired != null) setTotalRequired(r2.totalRequired);
      if (result.isComplete) { setChatComplete(true); try { localStorage.setItem(`nexos:chatComplete:${campaignId}`, "1"); } catch { /* ignore */ } }

      if (result.proposedType && result.proposedTrack) {
        setPendingProposal({
          type: result.proposedType,
          track: result.proposedTrack,
          reason: result.proposedReason,
        });
      }

      queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
    } catch (err) {
      // Revert optimistic user message and restore the input text.
      // The customFetch 401-retry already attempted a token refresh, so if we
      // still land here it was a genuine failure — let the user retry manually.
      setMessages(messages);
      setInputValue(userMsg);
      toast.error(
        err instanceof ApiError && err.status === 401
          ? "Sessão expirada. Tente enviar novamente — o token foi renovado automaticamente."
          : "Erro de comunicação com o agente. Sua mensagem foi preservada. Tente novamente.",
        { duration: 6000 },
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ── Finalize intake ────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await customFetch(`/api/intake/${campaignId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Briefing finalizado! Gerando Masterplan...");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar";
      // If intake is "too short", block navigation — otherwise go to campaign regardless
      if (msg.includes("Briefing muito curto")) {
        toast.error(msg);
        setFinalizing(false);
        return;
      }
      // For any other error (e.g. already finalized), warn but proceed — campaign may
      // already be in analyzing/strategy_ready which is exactly where we want to go.
      toast.warning("Briefing registrado — abrindo campanha.");
    }
    // Auto-trigger strategy pipeline immediately after finalize.
    // Fire-and-forget: we do NOT await this — just kick it off so detail.tsx
    // sees the pipeline running (not "PIPELINE PAROU") when the user lands there.
    customFetch(`/api/campaigns/${campaignId}/execute`, { method: "POST" }).catch(() => {
      // silently ignored — detail.tsx has a "Retomar Processamento" button as fallback
    });

    // Force-refresh campaign cache so detail.tsx sees the updated status (analyzing)
    // before its redirect useEffect fires. Without this refetch the stale "intake"
    // status in cache triggers an immediate redirect loop back to this page.
    try {
      await queryClient.refetchQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch {
      // non-blocking — navigate even if refetch fails
    }
    setLocation(`/campaigns/${campaignId}/strategy`);
    setFinalizing(false);
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Inicializando Briefing agente...</p>
        </div>
      </div>
    );
  }

  const isComplete = typeof data?.completeness === "object" && (data?.completeness as { valid?: boolean })?.valid;

  // ── Master Plan view: shown when user clicks the big button ──
  if (showMasterPlan) {
    return (
      <MasterPlanView
        formData={formData}
        onApprove={handleFinalize}
        onBack={() => setShowMasterPlan(false)}
        finalizing={finalizing}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 gap-4 md:gap-5 max-w-5xl mx-auto w-full min-h-0">
      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-4">
        <Link href={`/campaigns/${campaignId}`}>
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-3 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />Retornar à Campanha
          </Button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
                Briefing Estratégico
              </h1>
            </div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
              A agente entende seu produto, define o modelo ideal e extrai os dados automaticamente
            </p>
          </div>
          <div className="flex flex-col gap-2 bg-card/30 p-3 border border-border/40 min-w-[220px]">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Completude</span>
              <span className="font-mono text-xs font-bold text-primary">{(chatComplete || isComplete) ? 100 : progress}%</span>
            </div>
            <Progress value={(chatComplete || isComplete) ? 100 : progress} className="h-1.5 rounded-none bg-muted/30 [&>div]:bg-primary [&>div]:shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
            {totalRequired > 0 && (
              <div className="flex justify-between items-center pt-0.5">
                <span className="font-mono text-[10px] text-muted-foreground/60">Obrigatórios</span>
                <span className={`font-mono text-[10px] font-semibold ${chatComplete || isComplete || answeredRequired >= totalRequired ? "text-success" : "text-muted-foreground"}`}>
                  {(chatComplete || isComplete) ? totalRequired : answeredRequired}/{totalRequired}
                </span>
              </div>
            )}
            {scoreData && (
              <div className="flex justify-between items-center pt-1 border-t border-border/30">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Score</span>
                <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-success/30 text-success bg-success/10">
                  {scoreData.score} · {scoreData.label}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      <FeatureOnboarding
        featureKey={FEATURE_KEYS.BRIEFING}
        title="BRIEFING ESTRATÉGICO"
        description="Converse com o agente em linguagem natural — ela extrai os dados do seu produto, público e metas, e propõe o modelo de lançamento ideal."
        variant="banner"
        steps={[
          "Fale sobre seu produto como se estivesse contando para um amigo — sem jargão",
          "Use voz (microfone), envie um áudio MP3 ou um vídeo de apresentação — o sistema transcreve automaticamente",
          "A agente propõe o modelo ideal (PLF, Semente, Perpétuo…) com base nas suas respostas",
          "Quando completude ≥ 80%, o plano completo é gerado em segundos",
        ]}
      />

      {/* ── View toggle ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 border border-border/50 bg-card/40 p-1 rounded-sm">
          {[
            { id: "chat" as const, label: "Chat com agente", icon: MessageSquare },
            { id: "form" as const, label: "Formulário", icon: LayoutList },
          ].map((v) => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs md:text-xs font-mono uppercase tracking-widest transition-all rounded-sm
                ${view === v.id ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
              <v.icon className="h-3.5 w-3.5" />{v.label}
            </button>
          ))}
        </div>

        {/* Budget simulator toggle — appears when budget + price detected */}
        {(() => {
          const rawData = data?.intakeData as Record<string, unknown> | undefined;
          const detectedBudget = Number(rawData?.["campaign.budget.total"] ?? rawData?.["campaign.budget"] ?? 0);
          const detectedPrice = Number(rawData?.["product.price"] ?? rawData?.["product.preco"] ?? 0);
          if (detectedBudget > 0 && detectedPrice > 0) {
            return (
              <button
                onClick={() => setShowSimulator((s) => !s)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-widest border transition-all rounded-sm
                  ${showSimulator
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/30"}`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Simulação de Budget
                {showSimulator ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            );
          }
          return null;
        })()}
      </div>

      {/* ── Budget Simulator Panel ── */}
      {(() => {
        const rawData = data?.intakeData as Record<string, unknown> | undefined;
        const detectedBudget = Number(rawData?.["campaign.budget.total"] ?? rawData?.["campaign.budget"] ?? 0);
        const detectedPrice = Number(rawData?.["product.price"] ?? rawData?.["product.preco"] ?? 0);
        const detectedCategory = (rawData?.["product.category"] as string | undefined) ?? "infoproduct";
        const detectedType = (data as unknown as { type?: string } | undefined)?.type ?? "launch";

        if (!showSimulator || detectedBudget <= 0 || detectedPrice <= 0) return null;

        return (
          <BudgetSimulator
            campaignId={campaignId}
            budget={detectedBudget}
            productPrice={detectedPrice}
            campaignType={detectedType}
            productCategory={detectedCategory}
          />
        );
      })()}

      {/* ════════════════ CHAT VIEW ════════════════ */}
      {view === "chat" && (
        <div className="flex flex-col flex-1 min-h-0" style={{ minHeight: "520px" }}>
          {/* Info bar / "onde você parou" summary */}
          {isReturning && progress > 0 ? (
            <div className="border border-blue-400/30 bg-blue-400/5 px-3 py-2.5 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-blue-400 font-bold">
                    Retomando briefing · {progress}% concluído
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground/60">
                  {progress < 25 ? "Fase 1 — Produto" :
                   progress < 50 ? "Fase 2 — Audiência" :
                   progress < 70 ? "Fase 3 — Metas & Orçamento" :
                   progress < 90 ? "Fase 4 — Modelo de Campanha" :
                   "Fase 5 — Perguntas Específicas"}
                </span>
              </div>
              {(() => {
                const highlights: { label: string; value: string }[] = [];
                const fd = formData;
                if (fd["product.name"] || fd["product.nome"]) highlights.push({ label: "Produto", value: String(fd["product.name"] ?? fd["product.nome"]) });
                if (fd["product.price"] || fd["product.preco"]) highlights.push({ label: "Preço", value: `R$${Number(fd["product.price"] ?? fd["product.preco"]).toLocaleString("pt-BR")}` });
                if (fd["audience.avatar"] || fd["audience.target"]) highlights.push({ label: "Público", value: String(fd["audience.avatar"] ?? fd["audience.target"]).slice(0, 40) + (String(fd["audience.avatar"] ?? fd["audience.target"]).length > 40 ? "…" : "") });
                if (fd["campaign.budget.total"] || fd["campaign.budget"]) highlights.push({ label: "Budget", value: `R$${Number(fd["campaign.budget.total"] ?? fd["campaign.budget"]).toLocaleString("pt-BR")}` });
                if (highlights.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {highlights.map(h => (
                      <span key={h.label} className="font-mono text-[11px] text-muted-foreground">
                        <span className="text-foreground/60">{h.label}:</span> <span className="text-foreground/90 font-bold">{h.value}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3 shrink-0">
              <div className="w-6 h-6 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Database className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] text-primary font-bold uppercase tracking-widest mb-0.5">
                  Como funciona o briefing
                </div>
                <span className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
                  O agente vai fazer perguntas simples sobre seu produto, seu público e seus objetivos.
                  Responda com suas palavras — não precisa ser técnico. Em ~3 minutos, ela monta tudo.
                </span>
              </div>
            </div>
          )}

          {/* Board of specialists strip */}
          {messages.length === 0 && !sending && (
            <div className="border-x border-b border-border/40 bg-card/20 px-4 py-3 shrink-0">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-2">Especialistas na sala</div>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(INTAKE_AGENTS).map(([id, ag]) => (
                  <div key={id} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-sm border bg-card/80 flex items-center justify-center font-mono font-black text-[10px] ${ag.color} border-current/30`}>
                      {ag.initial}
                    </div>
                    <div>
                      <div className={`font-mono text-[10px] font-bold ${ag.color}`}>{ag.name}</div>
                      <div className="font-mono text-[8px] text-muted-foreground/40 leading-tight">{ag.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 border-x border-border/50">
            {/* Initial loading state while AI triggers */}
            {messages.length === 0 && sending && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-sm border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
                <div className="bg-card/80 border border-border/50 px-4 py-3 rounded-sm">
                  <div className="flex gap-1 items-center mb-1">
                    {[0, 150, 300].map((delay) => (
                      <div key={delay} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Preparando a sala de briefing...</span>
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const agentChanged = msg.role === "assistant" && (
                !prevMsg || prevMsg.role === "user" || prevMsg.agentId !== msg.agentId
              );
              return <ChatBubble key={i} msg={msg} showAgentLabel={agentChanged} />;
            })}

            {/* Sending indicator — shows current agent avatar if known */}
            {sending && messages.length > 0 && (() => {
              const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
              const thinkingAgentId = lastAssistant?.agentId;
              return (
                <div className="flex gap-2 md:gap-3">
                  <AgentAvatar agentId={thinkingAgentId} size="sm" />
                  <div className="bg-card/80 border border-border/50 px-4 py-3 rounded-sm">
                    <div className="flex gap-1 items-center">
                      {[0, 150, 300].map((delay) => (
                        <div key={delay} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Type proposal card — AI recommends a model */}
            {pendingProposal && !sending && (
              <TypeProposalCard
                proposedType={pendingProposal.type}
                proposedTrack={pendingProposal.track}
                proposedReason={pendingProposal.reason}
                onConfirm={() => void handleConfirmType()}
                onReject={() => void handleRejectType()}
                confirming={confirmingType}
              />
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── Completion CTA — replaces input when briefing is done ── */}
          {(chatComplete || isComplete) ? (
            <div className="border border-t-0 border-success/40 bg-success/5 shrink-0">
              {/* Top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-success/0 via-success to-success/0" />

              <div className="px-5 py-5 flex flex-col gap-4">
                {/* Status row */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border border-success/50 bg-success/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm uppercase tracking-widest text-success">
                      Briefing 100% Completo
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">
                      A agente coletou tudo que precisa para montar o Master Plan de Lançamento
                    </p>
                  </div>
                  <div className="shrink-0 font-mono text-2xl font-black text-success/20 hidden sm:block">
                    100%
                  </div>
                </div>

                {/* Data summary pills */}
                {(() => {
                  const fd = formData;
                  const pills: { label: string; value: string }[] = [];
                  const pName = fd["product.name"] ?? fd["product.nome"];
                  const pPrice = fd["product.price"] ?? fd["product.preco"];
                  const pAudience = fd["audience.avatar"] ?? fd["audience.target"];
                  const pBudget = fd["campaign.budget.total"] ?? fd["campaign.budget"];
                  if (pName) pills.push({ label: "Produto", value: String(pName) });
                  if (pPrice) pills.push({ label: "Preço", value: `R$${Number(pPrice).toLocaleString("pt-BR")}` });
                  if (pAudience) pills.push({ label: "Público", value: String(pAudience).slice(0, 35) + (String(pAudience).length > 35 ? "…" : "") });
                  if (pBudget) pills.push({ label: "Budget", value: `R$${Number(pBudget).toLocaleString("pt-BR")}` });
                  if (pills.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2">
                      {pills.map(p => (
                        <div key={p.label} className="border border-border/40 bg-card/60 px-3 py-1.5 flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{p.label}</span>
                          <span className="font-mono text-[11px] font-bold text-foreground/90">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* The big button — opens Master Plan for review first */}
                <Button
                  onClick={() => setShowMasterPlan(true)}
                  className="w-full font-mono uppercase tracking-widest rounded-none gap-2 h-14 text-sm btn-weapon-primary"
                  style={{ fontSize: "0.8rem", letterSpacing: "0.12em" }}
                >
                  <Rocket className="h-5 w-5" />Ver e Aprovar Master Plan do Lançamento<ChevronRight className="h-5 w-5" />
                </Button>

                <p className="font-mono text-[10px] text-center text-muted-foreground/40 uppercase tracking-widest -mt-1">
                  Estratégia · Calendário Editorial · Criativos · Projeções
                </p>
              </div>
            </div>
          ) : (
          /* Input */
          (
            <div className="border border-t-0 border-border/50 p-3 shrink-0 flex flex-col gap-2">

              {/* Hidden file inputs */}
              <input ref={fileInputRef} type="file" multiple className="hidden"
                accept=".txt,.md,.csv,.json,.html,.xml,.ts,.tsx,.js,.jsx,.py,.sql,.pdf,.doc,.docx,image/*"
                onChange={e => { void handleFileSelect(e); }} />
              <input ref={audioInputRef} type="file" className="hidden"
                accept="audio/*,video/*,.mp3,.mp4,.wav,.ogg,.m4a,.webm,.mov,.avi,.mkv"
                onChange={e => { void handleAudioVideoSelect(e); }} />

              {/* Pending files preview — familiar card style (like WhatsApp / iMessage) */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2.5 border-b border-border/30">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="relative group">
                      {f.isImage ? (
                        /* Image thumbnail — click to open full size */
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/60 bg-muted/20 shrink-0">
                          <a href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                            <img
                              src={f.url}
                              alt={f.name}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                            />
                          </a>
                          <button
                            onClick={() => removeFile(i)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : (
                        /* Document / audio card — clickable to open, X to remove */
                        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors px-3 py-2 pr-2 max-w-[200px]">
                          <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 flex-1 min-w-0" title={`Abrir ${f.name}`}>
                            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: f.isAudioVideo ? "hsl(260 60% 20%)" : f.mimeType === "application/pdf" ? "hsl(0 50% 12%)" : "hsl(220 30% 14%)" }}>
                              {f.isAudioVideo
                                ? <FileAudio className="h-4 w-4 text-violet-400" />
                                : f.mimeType === "application/pdf"
                                ? <File className="h-4 w-4 text-red-400" />
                                : <File className="h-4 w-4 text-blue-400" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-medium text-foreground truncate leading-tight">{f.name}</span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                {f.size ? (f.size >= 1_000_000 ? `${(f.size / 1_000_000).toFixed(1)} MB` : `${Math.round(f.size / 1_000)} KB`) : "Abrir ↗"}
                              </span>
                            </div>
                          </a>
                          <button
                            onClick={() => removeFile(i)}
                            className="ml-1 text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Transcribing indicator */}
              {isTranscribing && (
                <div className="flex items-center gap-2 px-2 py-1 border border-violet-500/40 bg-violet-500/10">
                  <Loader2 className="w-3 h-3 text-violet-400 animate-spin shrink-0" />
                  <span className="font-mono text-[11px] text-violet-400 uppercase tracking-widest">Transcrevendo… aguarde</span>
                </div>
              )}

              {/* Listening indicator */}
              {isListening && !isTranscribing && (
                <div className="flex items-center gap-2 px-2 py-1 border border-destructive/40 bg-destructive/10">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
                  <span className="font-mono text-[11px] text-destructive uppercase tracking-widest">Ouvindo… fale agora</span>
                  <button onClick={toggleVoice} className="ml-auto text-destructive"><X className="h-3 w-3" /></button>
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Digite sua resposta aqui... ou use o microfone para falar (o agente entende tudo)"
                disabled={sending || confirmingType}
                rows={isMobile ? 5 : 7}
                className="w-full font-mono text-sm bg-background/60 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm px-3 py-3 resize-y text-foreground placeholder:text-muted-foreground/50 transition-all min-h-[100px]"
              />

              {/* Action toolbar */}
              <div className="flex items-center gap-1.5">

                {/* Mic */}
                <button type="button" onClick={toggleVoice}
                  title={isListening ? "Parar gravação" : "Falar por voz (PT-BR)"}
                  className={`h-9 w-9 flex items-center justify-center border transition-all rounded-sm shrink-0
                    ${isListening
                      ? "border-destructive bg-destructive/20 text-destructive"
                      : "border-border/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground"}`}>
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                {/* Attach text/image */}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivo ou imagem"
                  className="h-9 px-2.5 flex items-center gap-1.5 border border-border/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all rounded-sm shrink-0">
                  <Paperclip className="h-4 w-4" />
                  <span className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline">Arquivo</span>
                  {pendingFiles.length > 0 && (
                    <span className="text-[9px] font-bold text-primary bg-primary/20 px-1 rounded-sm">{pendingFiles.length}</span>
                  )}
                </button>

                {/* Attach audio/video → Whisper transcription */}
                <button type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isTranscribing || sending}
                  title="Subir áudio ou vídeo — transcrição automática via transcrição (MP3, MP4, WAV, WebM…)"
                  className={`h-9 px-2.5 flex items-center gap-1.5 border transition-all rounded-sm shrink-0
                    ${isTranscribing
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-400 cursor-not-allowed"
                      : "border-border/50 bg-muted/10 hover:bg-violet-500/10 hover:border-violet-500/40 text-muted-foreground hover:text-violet-400"}`}>
                  {isTranscribing
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <FileAudio className="h-4 w-4" />}
                  <span className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline">
                    {isTranscribing ? "Transcrevendo…" : "Áudio/Vídeo"}
                  </span>
                </button>

                <div className="flex-1" />

                {/* New line (desktop) */}
                {!isMobile && (
                  <Button variant="outline" size="sm" title="Nova linha"
                    onClick={() => { setInputValue(v => v + "\n"); setTimeout(() => inputRef.current?.focus(), 0); }}
                    disabled={sending || confirmingType}
                    className="font-mono rounded-sm h-9 px-3 border-border/50 text-muted-foreground hover:text-foreground shrink-0">
                    <CornerDownLeft className="h-4 w-4" />
                  </Button>
                )}

                {/* Send */}
                <Button
                  onClick={() => void handleSend()}
                  disabled={sending || (inputValue.trim() === "" && pendingFiles.length === 0) || confirmingType}
                  title="Enviar (Enter)"
                  className="font-mono rounded-sm h-9 px-4 btn-weapon-primary shrink-0 gap-1.5">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /><span className="hidden sm:inline text-[11px] uppercase tracking-widest">Enviar</span></>}
                </Button>
              </div>

              <p className="text-[10px] font-mono text-muted-foreground/40 text-right">
                Enter = enviar · Shift+Enter = nova linha · suporta texto, imagens, PDF, áudio e vídeo
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════ FORM VIEW ════════════════ */}
      {view === "form" && (() => {
        const questions = data?.questions ?? [];
        const campaignStatus = (data as unknown as { status?: string })?.status ?? "";
        const isLive = !!campaignStatus && !["draft", "analyzing", "strategy_ready", "generating", "awaiting_approval"].includes(campaignStatus);

        // Group questions by section
        const sections = questions.reduce<Record<string, typeof questions>>((acc, q) => {
          const sec = (q as unknown as { section?: string }).section ?? "geral";
          if (!acc[sec]) acc[sec] = [];
          acc[sec].push(q);
          return acc;
        }, {});
        const sectionEntries = Object.entries(sections);

        const sectionLabels: Record<string, string> = {
          produto: "Produto",
          audiencia: "Audiência",
          criador: "Criador",
          conteudo: "Conteúdo",
          risco: "Riscos",
          lancamento: "Lançamento",
          geral: "Geral",
          metricas: "Métricas",
          estrategia: "Estratégia",
        };

        return (
          <div className="space-y-4">
            <div className="border border-border/50 bg-card/30 px-3 py-2 flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex-1">
                {isLive
                  ? "Briefing — modo somente leitura (campanha em execução)"
                  : "Edite campos individuais — sincronizados com o chat em tempo real"}
              </span>
              {isLive && (
                <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-yellow-500/40 text-yellow-400">
                  Read-only
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3 p-5 border border-border/50 bg-card/40">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="border border-border/50 bg-card/40 p-8 flex flex-col items-center justify-center text-center gap-3">
                <Database className="h-8 w-8 text-muted-foreground/30" />
                <p className="font-mono text-sm text-muted-foreground">
                  Nenhuma pergunta encontrada para este tipo de campanha.
                </p>
                <p className="font-mono text-[11px] text-muted-foreground/50">
                  Use o chat para preencher o briefing com ajuda do agente.
                </p>
                <Button variant="outline" size="sm" onClick={() => setView("chat")}
                  className="font-mono uppercase tracking-widest rounded-none border-border/50 text-xs mt-1">
                  <MessageSquare className="h-3.5 w-3.5 mr-2" />Abrir Chat
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {sectionEntries.map(([section, qs]) => (
                  <div key={section} className="border border-border/50 bg-card/40 backdrop-blur-sm">
                    <div className="px-4 py-2 border-b border-border/30 bg-muted/10">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {sectionLabels[section] ?? section}
                      </span>
                    </div>
                    <div className="p-4 md:p-5 space-y-5">
                      {qs.map((q) => {
                        const placeholder = (q as unknown as { placeholder?: string }).placeholder ?? "Insira os dados...";
                        const desc = (q as unknown as { description?: string }).description;
                        const opts = (q as unknown as { options?: { value: string; label: string }[] }).options;

                        return (
                          <div key={q.key} className="space-y-1.5 group">
                            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2 group-focus-within:text-primary transition-colors">
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 group-focus-within:bg-primary transition-all" />
                              {q.label}
                              {q.required && <span className="text-primary ml-0.5">*</span>}
                              {formData[q.key] && <Check className="h-3 w-3 text-emerald-500 ml-auto" />}
                            </label>
                            {desc && (
                              <p className="text-[11px] text-muted-foreground/50 font-mono pl-3">{desc}</p>
                            )}
                            {opts && opts.length > 0 ? (
                              <select
                                value={formData[q.key] ?? ""}
                                onChange={(e) => !isLive && setFormData((prev) => ({ ...prev, [q.key]: e.target.value }))}
                                disabled={isLive}
                                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm h-10 px-3 text-foreground disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                                <option value="">{placeholder}</option>
                                {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : q.type === "textarea" ? (
                              <textarea
                                value={formData[q.key] ?? ""}
                                onChange={(e) => !isLive && setFormData((prev) => ({ ...prev, [q.key]: e.target.value }))}
                                readOnly={isLive}
                                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm min-h-[90px] p-3 resize-y text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 read-only:opacity-70 transition-all"
                                placeholder={placeholder} />
                            ) : (
                              <input
                                value={formData[q.key] ?? ""}
                                onChange={(e) => !isLive && setFormData((prev) => ({ ...prev, [q.key]: e.target.value }))}
                                readOnly={isLive}
                                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-sm h-10 px-3 text-foreground placeholder:text-muted-foreground/50 read-only:opacity-70 transition-all"
                                placeholder={placeholder} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLive && questions.length > 0 && (
              <div className="flex flex-col md:flex-row gap-3">
                <Button variant="outline"
                  onClick={() => saveMutation.mutate({ campaignId, data: { intakeData: formData } })}
                  disabled={saveMutation.isPending}
                  className="font-mono uppercase tracking-widest rounded-none border-border/50 h-10 text-xs">
                  {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
                {isComplete && (
                  <Button onClick={() => setShowMasterPlan(true)}
                    className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10">
                    <Rocket className="h-4 w-4" />Ver e Aprovar Master Plan
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
