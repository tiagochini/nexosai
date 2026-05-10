import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import nexosLogo from "/nexos-logo.png";
import {
  ArrowRight, CheckCircle2, BarChart3, Mail, MessageSquare,
  BrainCircuit, Clock, Lock, Users, AlertTriangle,
  Building2, User, ChevronRight, Zap, Eye, Cpu, Radio,
  ChevronDown, ChevronUp, Shield, Target, Layers, Activity,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────────

type Segment = "individual" | "agency";

// ─── Launch phases ────────────────────────────────────────────────────────────
// Controlled server-side via LAUNCH_CAMPAIGN_DATE env var.
// Set it to an ISO date string to start the countdown.
const CURRENT_PHASE = "pre" as "pre" | "esquenta" | "abertura" | "fechamento";

const PHASES = [
  { id: "pre",       label: "Pré-lançamento",      sublabel: "Lista de espera aberta"   },
  { id: "esquenta",  label: "Esquenta",             sublabel: "Grupos WhatsApp ativos"   },
  { id: "abertura",  label: "Abertura do Carrinho", sublabel: "24h — sem exceções"        },
  { id: "fechamento",label: "Carrinho Fechado",     sublabel: "Próxima turma: indefinido" },
];

// ─── Segment data ─────────────────────────────────────────────────────────────

const SEGMENT_DATA = {
  individual: {
    badge: "Lançador Solo",
    groupLabel: "Grupo dos Lançadores",
    groupDesc: "Esquenta · Lançadores Solo",
    headline: "Seu primeiro lançamento de 6 dígitos.",
    sub: "Sem equipe, sem agência, sem freelancer. Seu único trabalho é conversar com a IA — ela entende o que você quer lançar, levanta o que ainda não foi pensado, calcula margem, investimento e viabilidade, e monta tudo para sua aprovação.",
    bullets: [
      "IA identifica e personaliza cada detalhe do seu lançamento",
      "Custo, budget, margem e precificação calculados antes do go-live",
      "Propostas sempre passam pela sua aprovação antes de serem executadas",
      "Da conversa com a IA ao carrinho aberto em 7 dias",
    ],
    // 10-day sequence — 2x/day (morning 9h + evening 20h)
    // Days 1–7: esquenta (group warming) · Days 8–10: cart open period
    esquentaSequence: [
      { slot: "Dia 1 · 09h", trigger: "Autoridade",    label: "PL1-M", content: "Bastidores: como surgiu o NexOS AI e o problema real que ele resolve — contado por quem construiu." },
      { slot: "Dia 1 · 20h", trigger: "Curiosidade",   label: "PL1-N", content: "O que seria possível se você não dependesse de equipe, agência ou freelancer para lançar?" },
      { slot: "Dia 2 · 09h", trigger: "Reciprocidade", label: "PL2-M", content: "Presente para o grupo: checklist completo dos 7 passos de um lançamento de 6 dígitos com IA." },
      { slot: "Dia 2 · 20h", trigger: "Transformação", label: "PL2-N", content: "Caso real: diagnóstico + estratégia + copy aprovado em menos de 24h — como funcionou na prática." },
      { slot: "Dia 3 · 09h", trigger: "Prova Social",  label: "PL3-M", content: "Números reais: taxa de abertura, conversão por segmento e receita gerada no primeiro lançamento com NexOS." },
      { slot: "Dia 3 · 20h", trigger: "Antecipação",   label: "PL3-N", content: "Preview exclusivo: as telas, o diagnóstico da IA em funcionamento e a sequência pronta para aprovação." },
      { slot: "Dia 4 · 09h", trigger: "Comunidade",    label: "PL4-M", content: "Quem está no grupo: perfis, produtos, metas. Você vai se identificar com alguém aqui dentro." },
      { slot: "Dia 4 · 20h", trigger: "Curiosidade",   label: "PL4-N", content: "A trilha de 6 dígitos: o que a IA calcula antes de montar sua estratégia — e que a maioria dos lançadores ignora." },
      { slot: "Dia 5 · 09h", trigger: "Autoridade",    label: "PL5-M", content: "Demo ao vivo: diagnóstico da IA em tempo real — produto real, números reais, estratégia gerada na hora." },
      { slot: "Dia 5 · 20h", trigger: "Antecipação",   label: "PL5-N", content: "Q&A no grupo: perguntas abertas sobre o lançamento, a plataforma e a meta de receita." },
      { slot: "Dia 6 · 09h", trigger: "Reciprocidade", label: "PL6-M", content: "Seguidores do @nexosai no Instagram: amanhã revelamos um código exclusivo. O bônus inclui módulo completo de apostila da plataforma + acompanhamento no seu primeiro lançamento." },
      { slot: "Dia 6 · 20h", trigger: "Escassez",      label: "PL6-N", content: "Código NEXOS liberado. Bônus para quem segue o Instagram E está no grupo: apostila completa da plataforma + suporte guiado no lançamento. Use na compra." },
      { slot: "Dia 7 · 09h", trigger: "Antecipação",   label: "PL7-M", content: "Amanhã o carrinho abre. Quem tem o código NEXOS garante a apostila + acompanhamento — sem custo extra." },
      { slot: "Dia 7 · 20h", trigger: "Medo de perder", label: "PL7-N", content: "Carrinho abre em menos de 12h. Código NEXOS = apostila da plataforma + suporte no seu lançamento. Só para quem está no grupo E segue o Instagram." },
      { slot: "Dia 8 · 09h", trigger: "Urgência",      label: "ABR1-M", content: "🚨 Carrinho aberto. Use NEXOS e resgate a apostila completa + acompanhamento no lançamento. Vagas limitadas — fecha em 72h." },
      { slot: "Dia 8 · 20h", trigger: "Prova Social",  label: "ABR1-N", content: "Primeiros compradores entrando: veja quem já garantiu e o que os fez decidir agir hoje." },
      { slot: "Dia 9 · 09h", trigger: "Urgência",      label: "ABR2-M", content: "48h de carrinho aberto. Código NEXOS ainda válido. Mais da metade das vagas já preenchidas." },
      { slot: "Dia 9 · 20h", trigger: "Transformação", label: "ABR2-N", content: "Imagine seu próximo lançamento: IA cuidando da estratégia enquanto você foca no produto." },
      { slot: "Dia 10 · 09h", trigger: "Escassez",     label: "FEC-M", content: "Último dia. Carrinho fecha hoje à meia-noite. Código NEXOS ativo — use agora ou perde o bônus." },
      { slot: "Dia 10 · 20h", trigger: "Fechamento",   label: "FEC-N", content: "Encerrado. Lista fechada. Próxima turma sem data definida. Bem-vindo a quem garantiu a vaga." },
    ],
    successTitle: "Você está no grupo dos Lançadores.",
    successBody: "Nos próximos 10 dias você recebe 2 mensagens por dia no WhatsApp: bastidores, demos e números reais. No Dia 6 revelamos o código NEXOS — exclusivo para quem segue o @nexosai no Instagram. O bônus: apostila completa da plataforma + acompanhamento guiado no seu primeiro lançamento. Quando o carrinho abrir, você é o primeiro a saber.",
    color: "primary" as const,
  },
  agency: {
    badge: "Agência / Gestor",
    groupLabel: "Grupo das Agências",
    groupDesc: "Esquenta · Agências & Gestores",
    headline: "Escale clientes com IA sem aumentar equipe.",
    sub: "White-label completo, multi-cliente, automação total de copy e sequência. Entregue mais lançamentos com a mesma operação — e com margem muito maior.",
    bullets: [
      "White-label — sua marca, sua operação",
      "Gestão de múltiplos clientes em um painel",
      "Entrega sem aumentar headcount",
      "Mais cliente = mais margem",
    ],
    // 8-day sequence — 2x/day (morning 9h + evening 20h)
    // Days 1–6: esquenta (group warming) · Days 7–8: cart open period
    esquentaSequence: [
      { slot: "Dia 1 · 09h", trigger: "Autoridade",    label: "PL1-M", content: "Como agências líderes estão usando IA para multiplicar entregas e margem sem contratar mais ninguém." },
      { slot: "Dia 1 · 20h", trigger: "Curiosidade",   label: "PL1-N", content: "Quanto sua agência deixa de ganhar hoje por não automatizar a operação de lançamento?" },
      { slot: "Dia 2 · 09h", trigger: "Reciprocidade", label: "PL2-M", content: "Modelo de precificação white-label: como cobrar mais por lançamento e entregar com menos headcount." },
      { slot: "Dia 2 · 20h", trigger: "Transformação", label: "PL2-N", content: "Caso real: agência que triplicou o número de clientes ativos sem contratar ninguém novo." },
      { slot: "Dia 3 · 09h", trigger: "Prova Social",  label: "PL3-M", content: "Painel multi-cliente ao vivo: como 5 clientes rodam em paralelo com total visibilidade — a IA propõe, o gestor aprova, tudo rastreado." },
      { slot: "Dia 3 · 20h", trigger: "Antecipação",   label: "PL3-N", content: "Preview técnico: white-label, painel multi-conta, relatório de performance por cliente." },
      { slot: "Dia 4 · 09h", trigger: "Comunidade",    label: "PL4-M", content: "Agências que já entraram: segmentos, ticket médio e o que esperam da plataforma." },
      { slot: "Dia 4 · 20h", trigger: "Curiosidade",   label: "PL4-N", content: "Simulação real: custo NexOS para uma agência vs quanto ela pode cobrar pelo serviço — os números." },
      { slot: "Dia 5 · 09h", trigger: "Autoridade",    label: "PL5-M", content: "Demo técnica ao vivo: white-label em funcionamento, painel multi-cliente, relatório de campanha gerado por IA." },
      { slot: "Dia 5 · 20h", trigger: "Reciprocidade", label: "PL5-N", content: "Seguidores do @nexosai no Instagram: amanhã revelamos código exclusivo com bônus para agências — apostila completa da plataforma + sessão de onboarding acompanhada." },
      { slot: "Dia 6 · 09h", trigger: "Escassez",      label: "PL6-M", content: "Código NEXOS liberado para agências: apostila completa da plataforma + onboarding guiado no primeiro lançamento do cliente. Só para quem segue o Instagram E está no grupo." },
      { slot: "Dia 6 · 20h", trigger: "Antecipação",   label: "PL6-N", content: "Amanhã o carrinho abre. Condições especiais para agências. Código NEXOS garante apostila + acompanhamento — sem custo adicional." },
      { slot: "Dia 7 · 09h", trigger: "Urgência",      label: "ABR1-M", content: "🚨 Carrinho aberto. Condições para agências ativas. Use NEXOS para resgatar apostila + onboarding guiado. 48h de janela." },
      { slot: "Dia 7 · 20h", trigger: "Prova Social",  label: "ABR1-N", content: "Agências que já garantiram: veja os primeiros perfis e o que os convenceu a agir agora." },
      { slot: "Dia 8 · 09h", trigger: "Escassez",      label: "FEC-M", content: "Menos de 12h. Vagas para agências limitadas. Código NEXOS ainda válido — último momento." },
      { slot: "Dia 8 · 20h", trigger: "Fechamento",    label: "FEC-N", content: "Encerrado. Condições de agência fechadas. Próxima turma sem data. Bem-vindo a quem garantiu." },
    ],
    successTitle: "Você está no grupo das Agências.",
    successBody: "Nos próximos 8 dias você recebe 2 mensagens por dia no WhatsApp: escala, white-label, demos e simulações reais. No Dia 5 revelamos o código NEXOS — exclusivo para quem segue o @nexosai no Instagram. O bônus: apostila completa da plataforma + onboarding guiado no primeiro lançamento do seu cliente. Quando o carrinho abrir, você tem prioridade e condições diferenciadas.",
    color: "success" as const,
  },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatWhatsApp(val: string) {
  const d = val.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

// ─── Phase bar ────────────────────────────────────────────────────────────────

function PhaseBanner() {
  const currentIdx = PHASES.findIndex(p => p.id === CURRENT_PHASE);
  const current = PHASES[currentIdx];
  return (
    <div className="fixed top-16 inset-x-0 z-40 border-b border-primary/20 bg-primary/5 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary font-bold">
            Fase atual: {current.label}
          </span>
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground/60 hidden sm:inline">
            · {current.sublabel}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-0">
          {PHASES.map((phase, i) => {
            const done = i < currentIdx;
            const active = phase.id === CURRENT_PHASE;
            return (
              <div key={phase.id} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition-all ${
                  active ? "text-primary font-bold" : done ? "text-muted-foreground/30 line-through" : "text-muted-foreground/25"
                }`}>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                  {done && <CheckCircle2 className="h-2.5 w-2.5" />}
                  {phase.label}
                </div>
                {i < PHASES.length - 1 && <span className="text-muted-foreground/20 font-mono text-xs">›</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Segment picker ───────────────────────────────────────────────────────────

function SegmentPicker({ onSelect }: { onSelect: (s: Segment) => void }) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-mono font-bold uppercase tracking-widest text-sm text-foreground">Lista de Espera</h3>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Primeiro — quem é você?</p>
      </div>

      {(["individual", "agency"] as Segment[]).map(seg => {
        const isAgency = seg === "agency";
        const color = isAgency ? "success" : "primary";
        const Icon = isAgency ? Building2 : User;
        return (
          <button
            key={seg}
            onClick={() => onSelect(seg)}
            className={`w-full text-left border border-border/50 bg-background/50 p-5 group hover:border-${color}/50 hover:bg-${color}/5 hover:shadow-[0_0_20px_hsl(var(--${color})/0.1)] transition-all duration-200 flex items-start gap-4 relative`}
          >
            <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l border-${color}/0 group-hover:border-${color} transition-colors`}></div>
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r border-${color}/0 group-hover:border-${color} transition-colors`}></div>
            <div className={`w-10 h-10 border border-${color}/30 bg-${color}/10 flex items-center justify-center shrink-0 group-hover:shadow-[0_0_10px_hsl(var(--${color})/0.3)] transition-all`}>
              <Icon className={`h-5 w-5 text-${color}`} />
            </div>
            <div className="flex-1">
              <div className={`font-mono font-bold text-sm uppercase tracking-wider text-foreground mb-1 group-hover:text-${color} transition-colors`}>
                {isAgency ? "Sou Agência / Gestor" : "Sou Produtor / Lançador"}
              </div>
              <div className="font-mono text-xs text-muted-foreground leading-relaxed">
                {isAgency ? "Lanço para clientes ou gerencio operações de lançamento" : "Tenho produto digital e quero lançar sozinho, sem equipe"}
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground/30 group-hover:text-${color} group-hover:translate-x-1 transition-all mt-0.5 shrink-0`} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Waitlist form ────────────────────────────────────────────────────────────

function WaitlistForm({ segment, onBack, onSuccess }: { segment: Segment; onBack: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const d = SEGMENT_DATA[segment];
  const color = d.color;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.replace(/\D/g, ""), segment, source: "landing" }),
      });
      const json = await res.json();
      if (res.ok || json.joined) {
        localStorage.setItem("nexos_joined", "true");
        localStorage.setItem("nexos_segment", segment);
        onSuccess();
      } else { toast.error("Erro ao entrar na lista. Tente novamente."); }
    } catch { toast.error("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className={`inline-flex items-center gap-1.5 border border-${color}/30 bg-${color}/5 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-${color} mb-2`}>
            {segment === "agency" ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {d.badge}
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{d.groupDesc}</p>
        </div>
        <button onClick={onBack} className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1">← Voltar</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wl-name" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Seu nome</Label>
          <Input id="wl-name" required placeholder="Como você se chama?" value={name} onChange={e => setName(e.target.value)} className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-sans h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-wa" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">WhatsApp (com DDD)</Label>
          <Input id="wl-wa" required placeholder="(11) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(formatWhatsApp(e.target.value))} className="rounded-none bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary font-mono h-12" />
        </div>
        <Button type="submit" disabled={loading} className={`w-full h-14 rounded-none font-mono uppercase tracking-widest font-black text-sm gap-3 mt-2 ${segment === "agency" ? "bg-success hover:bg-success/90 text-success-foreground" : "btn-weapon-primary"}`}>
          {loading ? "Entrando na lista..." : (
            <>Entrar na Lista de Espera <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
        <p className="text-center text-xs font-mono uppercase tracking-widest text-muted-foreground opacity-60">Sem spam · 2 mensagens/dia no grupo · Só conteúdo de lançamento</p>
      </form>
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({ segment }: { segment: Segment }) {
  const d = SEGMENT_DATA[segment];
  const color = d.color;
  const preview = d.esquentaSequence.slice(0, 4);
  return (
    <div className="space-y-5 py-2">
      <div className={`w-12 h-12 rounded-full bg-${color}/10 border border-${color}/30 flex items-center justify-center`}>
        <CheckCircle2 className={`h-6 w-6 text-${color} drop-shadow-[0_0_10px_hsl(var(--${color})/0.7)]`} />
      </div>
      <div>
        <h3 className="font-mono font-black uppercase tracking-wider text-base text-foreground mb-2">{d.successTitle}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{d.successBody}</p>
      </div>
      <div className={`border border-${color}/20 bg-${color}/5 p-4 space-y-3`}>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className={`h-3.5 w-3.5 text-${color}`} />
          <p className={`font-mono text-[11px] uppercase tracking-widest text-${color} font-bold`}>Preview da sequência — 2x ao dia</p>
        </div>
        {preview.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className={`font-mono text-[11px] uppercase tracking-widest text-${color}/60 mt-0.5 w-16 shrink-0`}>{item.slot}</span>
            <span className="font-mono text-xs text-muted-foreground leading-relaxed">{item.content}</span>
          </div>
        ))}
        <p className={`font-mono text-[11px] text-${color}/50 pt-1`}>+ {d.esquentaSequence.length - 4} mensagens até a abertura...</p>
      </div>
    </div>
  );
}

// ─── Post-registration hero replacement ───────────────────────────────────────

function PostRegistrationHero({ segment }: { segment: Segment }) {
  const d = SEGMENT_DATA[segment];
  const color = d.color;
  const Icon = segment === "agency" ? Building2 : User;
  return (
    <div className="relative">
      <div className="border border-primary/30 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary"></div>
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary"></div>
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary"></div>
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-12 h-12 border border-${color}/30 bg-${color}/10 flex items-center justify-center`}>
            <CheckCircle2 className={`h-6 w-6 text-${color} drop-shadow-[0_0_10px_hsl(var(--${color})/0.6)]`} />
          </div>
          <div>
            <div className={`font-mono text-[11px] uppercase tracking-widest text-${color} font-bold mb-0.5`}>
              <Icon className="h-3 w-3 inline mr-1" />{d.badge}
            </div>
            <div className="font-mono font-black uppercase tracking-wide text-sm text-foreground">
              Você está dentro da lista.
            </div>
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-5">
          {d.successBody}
        </p>
        <div className="border-t border-border/30 pt-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 text-center">
            Explore abaixo como o NexOS vai automatizar cada etapa do seu lançamento
          </p>
          <div className="flex justify-center mt-3">
            <div className="flex flex-col items-center gap-1 animate-bounce">
              <ChevronDown className="h-5 w-5 text-primary/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Features deep-dive (clicáveis pós-cadastro) ──────────────────────────────

const FEATURES = [
  {
    icon: BrainCircuit,
    label: "Diagnóstico com IA",
    tag: "Intake · Passo 1",
    summary: "A IA entende seu produto antes de qualquer execução.",
    detail: `Ao iniciar um lançamento, o NexOS conduz uma conversa estruturada de até 20 perguntas sobre o produto, o público, as metas e o histórico do criador. Com base nas respostas, ele calcula automaticamente:\n\n• Viabilidade financeira — margem de contribuição, custo de entrega, break-even\n• Investimento mínimo recomendado em tráfego para a trilha escolhida\n• Score de prontidão do produto (0–100) com red flags sinalizados antes de avançar\n• Tipo de lançamento mais adequado: PLF, Semente, Perpétuo ou Afiliado\n\nNada avança para estratégia sem o diagnóstico aprovado. É a IA fazendo o trabalho de um estrategista sênior em minutos.`,
  },
  {
    icon: Target,
    label: "Estratégia gerada automaticamente",
    tag: "Strategy · Passo 2",
    summary: "Claude monta o plano completo do lançamento.",
    detail: `Após o diagnóstico, o agente de estratégia (Claude) define:\n\n• Trilha de receita: 6 dígitos (R$100k–R$999k), 8 dígitos (R$10M+) ou 10 dígitos (R$100M+)\n• Cronograma de 7 a 10 dias dividido em fases: Pré-lançamento → Esquenta → Carrinho → Fechamento\n• Gatilhos mentais por fase: autoridade, curiosidade, prova social, urgência, escassez — sequenciados pelo comportamento esperado do lead\n• Estrutura de copy por plataforma: WhatsApp, email e social\n\nTudo isso é apresentado para a sua aprovação antes de qualquer execução. Você vê o plano completo, pode solicitar ajustes e só então confirma.`,
  },
  {
    icon: Mail,
    label: "Copy por segmento de lead",
    tag: "Copywriting · Agente GPT-4o",
    summary: "Mensagens diferentes para leads quentes, mornos e frios.",
    detail: `O agente de copy (GPT-4o) escreve versões específicas de cada mensagem para três perfis:\n\n• Hot (score ≥ 60): Insider VIP — copy de oferta direta, exclusividade, acesso privilegiado\n• Warm (score ≥ 25): Urgência padrão — benefícios + prazo + prova social\n• Cold (score < 25): Curiosidade + reativação — gatilho de dor ou transformação, sem pressão\n\nO score de cada lead é calculado em tempo real: abertura de email vale 50 pontos, clique vale 50. O NexOS recalcula o segmento de cada contato após cada interação e ajusta o próximo disparo automaticamente — sem nenhuma ação manual.`,
  },
  {
    icon: MessageSquare,
    label: "Sequência WhatsApp + Email automática",
    tag: "Launch Sequence · Scheduler",
    summary: "Disparos nos horários certos, toda vez, sem falhar.",
    detail: `Depois de aprovada a estratégia, o NexOS agenda cada mensagem para o momento exato. O scheduler interno verifica a cada 60 segundos quais itens estão prontos para disparo com base no calendário do lançamento.\n\n• WhatsApp Business: envia via Meta API para leads com alto engajamento. Mensagens formatadas com quebras de linha, emojis e CTAs calibrados por fase\n• Email: integrado com RD Station e ActiveCampaign. Assuntos testados por IA, preview text otimizado, horário de maior abertura por segmento\n• Calendário de lançamento: cada item tem um dayIndex (dia relativo à ativação) — quando você ativa a sequência, todas as datas são calculadas automaticamente\n\nVocê pode ver o calendário completo, dia a dia, com o status de cada mensagem (agendada, enviada, erro).`,
  },
  {
    icon: Users,
    label: "Segmentação hot / warm / cold em tempo real",
    tag: "CRM · Segmentação automática",
    summary: "Cada lead tem um score que muda a cada interação.",
    detail: `O NexOS mantém um score de engajamento (0–100) para cada contato na sequência:\n\n• Score = (taxa de abertura × 50) + (taxa de clique × 50)\n• Hot (≥ 60): lead ativo, engajado, pronto para oferta\n• Warm (≥ 25): interesse moderado, precisa de mais prova e urgência\n• Cold (< 25): pouco engajamento, abordagem de reativação\n\nAlém dos três segmentos principais, o NexOS rastreia:\n• Convertidos: compraram — removidos dos disparos de venda, entram no pós-venda\n• Descadastrados: clicaram em unsubscribe — nunca mais recebem mensagem\n\nO recálculo acontece automaticamente após cada evento de abertura, clique ou compra — confirmado pelos webhooks de email ou pelos eventos de venda do Hotmart/Kiwify.`,
  },
  {
    icon: Shield,
    label: "Aprovação antes de ir ao ar",
    tag: "Approval · Controle total",
    summary: "Nada sai sem você ver e aprovar.",
    detail: `Toda proposta gerada pelo NexOS passa por uma tela de aprovação antes de ser executada. Isso inclui:\n\n• Copy de email e WhatsApp por fase\n• Criativos e peças visuais (gerados pela IA com pré-voo de conceito)\n• Orçamento de tráfego e distribuição por canal\n• Estratégia geral e cronograma do lançamento\n\nO fluxo de aprovação:\n1. IA gera a proposta\n2. Você recebe para revisão (notificação + painel)\n3. Aprova com um clique, solicita ajuste (a IA reescreve em segundos) ou rejeita\n4. Red flags são sinalizados proativamente: inconsistências de copy, budget acima do esperado, timing inadequado\n\nVocê tem controle total, sem precisar fazer o trabalho manual.`,
  },
  {
    icon: Activity,
    label: "Dashboard de performance em tempo real",
    tag: "Métricas · Health Score",
    summary: "Health score automático com alertas e otimização por IA.",
    detail: `O NexOS mantém um health score de 0–100 para cada campanha ativa, calculado a partir de 5 componentes:\n\n• Receita realizada vs meta (35 pontos)\n• ROAS — retorno sobre investimento em tráfego (25 pontos)\n• CPL — custo por lead captado (20 pontos)\n• Taxa de abertura de email (10 pontos)\n• Tendência das últimas 24h — subindo ou caindo (10 pontos)\n\nAlertas automáticos são gerados nos thresholds críticos. Se o health score cair abaixo de 30, o agente de otimização (Gemini) é acionado automaticamente e apresenta sugestões de ajuste — mudança de copy, redistribuição de budget, mudança de segmentação — sempre com sua aprovação antes de qualquer execução.`,
  },
  {
    icon: Layers,
    label: "Carrinho com urgência real e automática",
    tag: "Cart · Abertura e Fechamento",
    summary: "Abre e fecha no horário exato, com copy diferente por perfil.",
    detail: `O NexOS controla a abertura e o fechamento do carrinho sem intervenção manual. No momento de abertura:\n\n• Leads hot recebem copy VIP de abertura: insider, acesso privilegiado, bônus exclusivo\n• Leads warm recebem urgência padrão: prazo + benefícios + prova social recente\n• Leads cold recebem curiosidade de reativação: dor + transformação, sem pressão de oferta direta\n\nDurante o período de carrinho aberto (24h padrão):\n• Mensagens intermediárias no dia 2 reforçam a urgência por segmento\n• Na última hora antes do fechamento, disparo automático para todos os não-convertidos\n• No fechamento, mensagem de encerramento com confirmação de próxima turma\n\nTudo isso acontece automaticamente, nos horários definidos pela estratégia, sem você precisar disparar nada manualmente.`,
  },
];

function FeaturesDeepDive() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-20 max-w-5xl mx-auto px-6">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-6 font-mono text-xs uppercase tracking-[0.3em] text-primary">
          <Zap className="h-3 w-3" />
          Como o NexOS faz isso automaticamente
        </div>
        <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight text-foreground mb-4">
          Cada etapa do lançamento.<br />
          <span className="text-primary">Orquestrada pela plataforma.</span>
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
          Clique em cada funcionalidade para entender exatamente como o NexOS executa — o que acontece nos bastidores, qual agente de IA atua e o que você precisa fazer (só aprovar).
        </p>
      </div>

      <div className="space-y-2">
        {FEATURES.map((feat, i) => {
          const Icon = feat.icon;
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              className={`border transition-all duration-200 overflow-hidden cursor-pointer ${
                isOpen
                  ? "border-primary/40 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.08)]"
                  : "border-border/40 bg-card/30 hover:border-primary/25 hover:bg-primary/3"
              }`}
              onClick={() => setOpenIdx(isOpen ? null : i)}
            >
              <div className="flex items-center gap-4 p-5">
                <div className={`w-10 h-10 border flex items-center justify-center shrink-0 transition-all ${
                  isOpen ? "border-primary/50 bg-primary/10" : "border-border/40 bg-muted/30"
                }`}>
                  <Icon className={`h-5 w-5 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`font-mono font-bold text-sm uppercase tracking-wide transition-colors ${isOpen ? "text-foreground" : "text-foreground/80"}`}>
                      {feat.label}
                    </span>
                    <span className={`font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 border transition-colors ${
                      isOpen ? "border-primary/30 text-primary bg-primary/5" : "border-border/30 text-muted-foreground/50"
                    }`}>
                      {feat.tag}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5 leading-relaxed">{feat.summary}</p>
                </div>
                <div className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                  <ChevronDown className={`h-4 w-4 ${isOpen ? "text-primary" : "text-muted-foreground/40"}`} />
                </div>
              </div>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-primary/15">
                  <div className="pt-4 pl-14">
                    {feat.detail.split("\n").map((line, li) => {
                      if (line.startsWith("•")) {
                        return (
                          <div key={li} className="flex items-start gap-2 mb-1.5">
                            <div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                            <span className="font-mono text-xs text-muted-foreground leading-relaxed">{line.slice(2)}</span>
                          </div>
                        );
                      }
                      if (line.match(/^\d+\./)) {
                        return (
                          <div key={li} className="flex items-start gap-2 mb-1.5">
                            <span className="font-mono text-[11px] text-primary/70 shrink-0 w-4">{line.split(".")[0]}.</span>
                            <span className="font-mono text-xs text-muted-foreground leading-relaxed">{line.slice(line.indexOf(".") + 2)}</span>
                          </div>
                        );
                      }
                      if (line === "") return <div key={li} className="h-3" />;
                      return (
                        <p key={li} className="font-mono text-xs text-muted-foreground leading-relaxed mb-1">{line}</p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function HeroCard() {
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [, navigate] = useLocation();

  const handleSuccess = (seg: Segment) => {
    navigate(`/preparacao?segment=${seg}`);
  };

  return (
    <div className="relative">
      <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_40px_hsl(var(--primary)/0.1)]">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary"></div>
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary"></div>
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary"></div>

        {showWaitlist && !segment
          ? <SegmentPicker onSelect={setSegment} />
          : showWaitlist && segment
          ? <WaitlistForm segment={segment} onBack={() => setSegment(null)} onSuccess={() => handleSuccess(segment)} />
          : (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
                  Testes privados · Acesso disponível agora
                </div>
                <h3 className="font-mono font-black uppercase tracking-wide text-base text-foreground mb-2">
                  Aderir à NexOS AI
                </h3>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  Crie sua conta agora e comece a operar com os 29 agentes de IA. Acesso completo à plataforma de lançamento.
                </p>
              </div>

              <div className="border border-border/30 bg-background/30 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Acesso completo</div>
                  <div className="font-mono font-black text-2xl text-foreground mt-0.5">R$3.990</div>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground/60 text-right leading-relaxed">
                  Pagamento único<br />Créditos não expiram
                </div>
              </div>

              <Link href="/comprar">
                <Button className="w-full h-14 rounded-none btn-weapon-primary font-mono uppercase tracking-widest font-black text-sm gap-3">
                  Aderir à Plataforma <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-border/30"></div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40">ou</span>
                <div className="flex-1 border-t border-border/30"></div>
              </div>

              <button
                onClick={() => setShowWaitlist(true)}
                className="w-full font-mono text-xs uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1"
              >
                Entrar na lista de espera do esquenta →
              </button>
            </div>
          )
        }
      </div>
      <div className="mt-4 flex items-center gap-2 justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground/50">
        <Lock className="h-3 w-3" />
        Fase de testes privada · Dados protegidos
      </div>
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────

type CountdownState = {
  days: number; hours: number; minutes: number; seconds: number; done: boolean;
};

function CountdownTimer({ launchDate }: { launchDate: Date | null }) {
  const [time, setTime] = useState<CountdownState>({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });

  useEffect(() => {
    if (!launchDate) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true }); return; }
    const tick = () => {
      const diff = launchDate.getTime() - Date.now();
      if (diff <= 0) { setTime({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true }); return; }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        done: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [launchDate]);

  if (time.done) {
    return (
      <div className="border border-primary/20 bg-primary/5 px-8 py-6 text-center space-y-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse mx-auto mb-3"></div>
        <p className="font-mono font-black uppercase tracking-widest text-lg text-foreground">
          Novo ciclo de adesões
        </p>
        <p className="font-mono font-black uppercase tracking-widest text-lg text-primary">
          será aberto em breve.
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60 pt-2">
          Entre na lista de espera para ser notificado primeiro
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { v: time.days, l: "Dias" },
        { v: time.hours, l: "Horas" },
        { v: time.minutes, l: "Min" },
        { v: time.seconds, l: "Seg" },
      ].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center border border-primary/30 bg-primary/5 p-4">
          <span className="font-mono font-black text-4xl text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
            {String(v).padStart(2, "0")}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Landing() {
  const [launchDate, setLaunchDate] = useState<Date | null>(null);
  const [launchLoaded, setLaunchLoaded] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [joinedSegment, setJoinedSegment] = useState<Segment>("individual");

  useEffect(() => {
    fetch("/api/waitlist/launch-config")
      .then(r => r.json())
      .then(d => {
        setLaunchDate(d.launchDate ? new Date(d.launchDate) : null);
        setLaunchLoaded(true);
      })
      .catch(() => setLaunchLoaded(true));

    const joined = localStorage.getItem("nexos_joined") === "true";
    const seg = (localStorage.getItem("nexos_segment") ?? "individual") as Segment;
    setAlreadyJoined(joined);
    setJoinedSegment(seg);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-28 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <img src={nexosLogo} alt="NexOS AI" className="h-24 w-24 object-contain" style={{ filter: "drop-shadow(0 0 18px hsl(var(--primary)/0.7))" }} />
            <div className="hidden sm:block">
              <div className="font-mono font-black text-3xl tracking-[0.15em] uppercase leading-tight">NexOS <span className="text-primary">AI</span></div>
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70 leading-tight">Plataforma de Lançamento</div>
            </div>
          </div>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">Já tenho acesso</Button>
          </Link>
        </div>
      </nav>

      {/* PHASE BANNER */}
      <PhaseBanner />

      {/* ─── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-28 overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16">
          <div>
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-8 font-mono text-xs uppercase tracking-[0.3em] text-primary">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              Automated Launch · Pré-lançamento em andamento
            </div>
            <h1 className="text-5xl md:text-6xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
              Seu produto digital<br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">no ar em 7 dias.</span><br />
              <span className="text-foreground/50 text-3xl md:text-4xl mt-2 block">Orquestrado por IA, aprovado por você.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              A IA entende seu produto, calcula viabilidade, monta estratégia e executa a sequência —&nbsp;
              <strong className="text-foreground">cada proposta passa pela sua aprovação antes de ir ao ar.</strong>
            </p>
            {!alreadyJoined && (
              <div className="space-y-3 mb-8">
                {[
                  "Carrinho aberto por apenas 24 horas",
                  "Dois grupos de esquenta — lançadores e agências",
                  "2 mensagens por dia · conteúdo de lançamento estruturado",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
          {alreadyJoined
            ? <PostRegistrationHero segment={joinedSegment} />
            : <HeroCard />
          }
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* ─── META: este lançamento É o produto ───────────────────────────── */}
      <section className="border-y border-primary/20 bg-primary/5 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary mb-6">
                <Cpu className="h-3 w-3" />
                Meta · Prova de Conceito
              </div>
              <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight text-foreground mb-4">
                Este lançamento<br />é operado pelo<br />
                <span className="text-primary">próprio NexOS AI.</span>
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Não estamos te contando sobre automação de lançamento. Estamos <strong className="text-foreground">executando um lançamento automatizado enquanto você lê isso.</strong> Cada fase, cada gatilho mental, cada disparo no grupo — gerado e orquestrado pela plataforma que você vai conhecer.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: BrainCircuit, label: "Estratégia do lançamento",    value: "Gerada por Claude com base no produto, público e trilha de receita" },
                { icon: Mail,         label: "Copy desta página",           value: "Estruturado seguindo Fórmula de Lançamento com gatilhos sequenciados" },
                { icon: MessageSquare,label: "Conteúdo dos grupos",         value: "8 mensagens (2x/dia por 4 dias) — PL1 → PL2 → PL3 → Abertura" },
                { icon: BarChart3,    label: "Segmentação dos leads",       value: "Lançadores e agências em grupos separados, copy diferente" },
                { icon: Zap,          label: "Disparo automático",          value: "Horário fixo: 09h e 20h por segmento, sem intervenção manual" },
                { icon: Radio,        label: "Abertura do carrinho",        value: "24h exatas, com urgência real — controlada pela plataforma" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 border border-border/30 bg-background/50 p-3 hover:border-primary/30 transition-colors">
                  <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{item.label}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SEQUÊNCIA VISÍVEL — 2x ao dia por segmento ──────────────────── */}
      <section className="py-24 max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-4">A Sequência em Andamento</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
            O que você vai receber<br />depois de entrar na lista.
          </h2>
          <p className="text-muted-foreground mt-4 text-sm max-w-lg mx-auto leading-relaxed">
            Esta é a sequência PLF de 4 dias que o NexOS AI executa para este lançamento — 2 mensagens por dia, gatilho mental definido por IA, horário fixo, grupos separados por perfil.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {(["individual", "agency"] as Segment[]).map(seg => {
            const d = SEGMENT_DATA[seg];
            const color = d.color;
            const Icon = seg === "agency" ? Building2 : User;
            return (
              <div key={seg} className="border border-border/40 overflow-hidden">
                <div className={`p-5 border-b border-border/40 bg-${color}/10 flex items-center gap-3`}>
                  <Icon className={`h-4 w-4 text-${color}`} />
                  <div>
                    <div className={`font-mono text-xs uppercase tracking-widest text-${color} font-bold`}>{d.badge}</div>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{d.groupLabel} · 2 msgs/dia</div>
                  </div>
                </div>
                <div className="divide-y divide-border/20 relative">
                  <div className="absolute left-[4.5rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 to-transparent pointer-events-none"></div>
                  {d.esquentaSequence.map((item, i) => {
                    const isAbertura = item.label.startsWith("ABR");
                    const isEvening = item.slot.includes("20h");
                    return (
                      <div key={i} className={`p-4 flex items-start gap-3 ${isAbertura ? `bg-${color}/5` : isEvening ? "bg-muted/20" : ""}`}>
                        <div className="text-right shrink-0 w-16">
                          <div className={`font-mono text-[11px] uppercase tracking-widest leading-none ${isAbertura ? `text-${color} font-bold` : "text-muted-foreground/50"}`}>
                            {item.slot.split(" · ")[0]}
                          </div>
                          <div className={`font-mono text-[11px] font-bold ${isAbertura ? `text-${color}` : isEvening ? "text-muted-foreground/40" : "text-primary/50"}`}>
                            {item.slot.split(" · ")[1]}
                          </div>
                        </div>
                        <div className={`w-px self-stretch ${isAbertura ? `bg-${color}/40` : "bg-border/30"} shrink-0`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`font-mono text-[11px] uppercase tracking-widest px-1.5 py-0.5 border ${
                              isAbertura ? `border-${color}/40 text-${color} bg-${color}/10` : "border-border/30 text-muted-foreground/50"
                            }`}>{item.label}</span>
                            <span className="font-mono text-[11px] text-muted-foreground/40">· {item.trigger}</span>
                          </div>
                          <p className="font-mono text-xs text-foreground leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── COUNTDOWN ───────────────────────────────────────────────────── */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur-sm py-12">
        <div className="max-w-xl mx-auto px-6 text-center space-y-5">
          {launchLoaded && !launchDate ? (
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Abertura do ciclo</p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Abertura do carrinho em</p>
          )}
          <CountdownTimer launchDate={launchDate} />
          {!launchDate && launchLoaded && (
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
              Entre na lista · Você será notificado quando o esquenta começar
            </p>
          )}
          {launchDate && (
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
              Quem não estiver na lista não recebe o link · Sem segunda chance
            </p>
          )}
        </div>
      </section>

      {/* ─── FEATURES CLICÁVEIS (pós-cadastro) ──────────────────────────── */}
      <FeaturesDeepDive />

      {/* ─── TRANSFORMAÇÃO ───────────────────────────────────────────────── */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-4">O que você passa a ter</p>
          <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
            A transformação real<br />do lançamento automatizado.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border/40 overflow-hidden">
          <div className="border-r border-border/40">
            <div className="p-5 border-b border-border/40 bg-destructive/10">
              <h3 className="font-mono text-xs uppercase tracking-widest text-destructive font-bold">Lançamento do jeito atual</h3>
            </div>
            {[
              ["Copywriter por projeto", "R$3k–8k"],
              ["Gestor de tráfego + social media", "R$2k–4k/mês"],
              ["Agência de email marketing", "R$1.5k–3k/mês"],
              ["CRM + automação separada", "R$500–2k/mês"],
              ["60–90 dias de preparação", "Todo lançamento"],
              ["5+ ferramentas descoordenadas", "Risco operacional alto"],
              ["Depende de todo mundo funcionar junto", "Quase nunca funciona"],
            ].map(([item, cost], i) => (
              <div key={i} className="p-4 border-b border-border/20 last:border-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive/50 shrink-0"></div>
                  <span className="font-mono text-sm text-muted-foreground line-through decoration-destructive/30">{item}</span>
                </div>
                <span className="font-mono text-xs text-destructive/60 shrink-0">{cost}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="p-5 border-b border-border/40 bg-success/10">
              <h3 className="font-mono text-xs uppercase tracking-widest text-success font-bold">Com NexOS AI</h3>
            </div>
            {[
              ["Copy por IA — por segmento, por fase", "Incluído"],
              ["Sequência automatizada completa", "Incluído"],
              ["Email + WhatsApp integrado e automático", "Incluído"],
              ["CRM + segmentação hot/warm/cold por IA", "Incluído"],
              ["7 a 10 dias de esquenta estruturado com IA", "Todo lançamento"],
              ["Código @nexosai = apostila + onboarding acompanhado", "Toda turma"],
              ["Uma plataforma, tudo centralizado", "Zero risco operacional"],
            ].map(([item, tag], i) => (
              <div key={i} className="p-4 border-b border-border/20 last:border-0 flex items-center justify-between hover:bg-success/5 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 drop-shadow-[0_0_5px_hsl(var(--success)/0.4)]" />
                  <span className="font-mono text-sm text-foreground">{item}</span>
                </div>
                <span className="font-mono text-xs text-success/70 shrink-0">{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMO FUNCIONA — 4 passos ────────────────────────────────────── */}
      <section className="py-24 border-t border-border/30 bg-card/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-4">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-mono font-black uppercase tracking-tight">
              Da ideia ao lançamento.<br />4 etapas. 7 a 10 dias.
            </h2>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden md:block"></div>
            <div className="space-y-0">
              {[
                { n: "01", icon: Clock,       label: "PL-Prep",  title: "Diagnóstico profundo com IA",  desc: "A IA conduz um atendimento personalizado: entende o produto, o público, as metas — e levanta o que você ainda não pensou. Calcula custo de entrega, investimento necessário, margem potencial e viabilidade financeira antes de montar qualquer estratégia." },
                { n: "02", icon: BrainCircuit,label: "Estratégia",title: "Estratégia sob medida",          desc: "Com base no diagnóstico, Claude escolhe a trilha certa (6, 8 ou 10 dígitos), monta cronograma de 7 dias, define gatilhos por fase e gera a sequência completa — tudo calibrado para o seu lançamento específico." },
                { n: "03", icon: Eye,          label: "Aprovação", title: "Você aprova, a IA ajusta", desc: "Toda proposta — copy, sequência, criativo, orçamento — passa pela sua revisão antes de ser executada. Feedback vira ajuste em segundos. Red flags são sinalizados proativamente antes de qualquer disparo." },
                { n: "04", icon: Zap,          label: "Execução",  title: "Execução orquestrada",      desc: "Com tudo aprovado, NexOS dispara no horário certo, para o segmento certo. Monitora engajamento em tempo real e sugere otimizações quando o score cai — sempre com sua ciência antes de adaptar." },
              ].map((step, i) => (
                <div key={i} className="flex gap-8 py-10 border-b border-border/30 last:border-0 group">
                  <div className="flex-shrink-0 w-16 h-16 border border-primary/30 bg-primary/5 flex items-center justify-center font-mono font-black text-2xl text-primary group-hover:border-primary/70 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all relative z-10">
                    {step.n}
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-3 mb-2">
                      <step.icon className="h-4 w-4 text-primary" />
                      <span className="font-mono font-bold uppercase tracking-wider text-sm text-foreground">{step.title}</span>
                      <span className="font-mono text-[11px] uppercase tracking-widest text-primary/50 border border-primary/20 px-2 py-0.5">{step.label}</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden auth-bg-gradient">
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          {alreadyJoined ? (
            <div className="text-center space-y-8">
              <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-primary">
                <CheckCircle2 className="h-3 w-3" />
                Você já está na lista de espera
              </div>
              <h2 className="text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-none">
                Fique de olho no<br />
                <span className="text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">WhatsApp cadastrado.</span>
              </h2>
              <p className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Quando o esquenta começar, você recebe 2 mensagens por dia com bastidores, demos e os números reais do lançamento. No Dia 6 revelamos o código NEXOS — exclusivo para quem acompanhar.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/preparacao">
                  <Button className="btn-weapon-primary font-mono uppercase tracking-widest font-bold gap-2 h-14 px-8">
                    Falar com o Jeff agora <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="font-mono uppercase tracking-widest text-xs h-14 px-8 rounded-none border-border/50">
                    Já tenho acesso → Entrar
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 mb-8 font-mono text-xs uppercase tracking-[0.3em] text-primary">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
                  Testes privados · Acesso disponível agora
                </div>
                <h2 className="text-4xl md:text-5xl font-mono font-black uppercase tracking-tighter leading-none mb-6">
                  Aderir à NexOS AI.<br />
                  <span className="text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">Plataforma de Lançamento.</span>
                </h2>
                <p className="text-base text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
                  Acesso completo aos 29 agentes de IA. Diagnóstico, estratégia, copy, sequência WhatsApp + Email e dashboard de performance — tudo operado e aprovado por você.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                  <Link href="/comprar">
                    <Button className="btn-weapon-primary font-mono uppercase tracking-widest font-bold gap-2 h-14 px-10 rounded-none text-sm">
                      Aderir à Plataforma <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" className="font-mono uppercase tracking-widest text-xs h-14 px-8 rounded-none border-border/50">
                      Já tenho acesso → Entrar
                    </Button>
                  </Link>
                </div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40">
                  Pagamento único · R$3.990 · Créditos não expiram · Acesso imediato
                </p>
              </div>
              <div className="max-w-md mx-auto">
                <HeroCard />
              </div>
            </>
          )}
        </div>
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
      </section>

    </div>
  );
}
