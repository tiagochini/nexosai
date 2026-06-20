import { useEffect, useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Shield, Zap, TrendingUp, Bot, ChevronRight,
  BarChart3, Clock, Target, Loader2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProofCase {
  id: string;
  title: string;
  metric: string;
  value: string;
  detail: string;
  category: "revenue" | "execution" | "automation" | "speed";
}

interface Summary {
  totalCampaigns: number;
  agentSuccessRate: number;
  totalRevenueBrl: number;
  liveCampaigns: number;
  generatedAt: string;
}

const CAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  revenue: TrendingUp,
  execution: Target,
  automation: Bot,
  speed: Clock,
};

const CAT_COLORS: Record<string, string> = {
  revenue:    "text-emerald-400 border-emerald-900/60 bg-emerald-950/30",
  execution:  "text-indigo-400 border-indigo-900/60 bg-indigo-950/30",
  automation: "text-cyan-400 border-cyan-900/60 bg-cyan-950/30",
  speed:      "text-amber-400 border-amber-900/60 bg-amber-950/30",
};

export default function SelfProofPage() {
  const [cases, setCases] = useState<ProofCase[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<{ cases: ProofCase[]; summary: Summary }>("/api/self-proof/cases")
      .then((d: { cases: ProofCase[]; summary: Summary }) => {
        setCases(d.cases);
        setSummary(d.summary);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmtBRL = (v: number) =>
    v > 0
      ? `R$${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
      : "—";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary/70">Self-Proof Engine</span>
        </div>
        <h1 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground">
          NexOS Prova a Si Mesmo
        </h1>
        <p className="font-mono text-sm text-muted-foreground/60 leading-relaxed max-w-2xl">
          A plataforma que usa a própria metodologia como vitrine. Métricas reais da execução interna,
          capturadas em tempo real pelo Self-Proof Engine.
        </p>
      </div>

      {/* Live stats strip */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground/50 font-mono text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando métricas ao vivo...
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Campanhas criadas", value: summary.totalCampaigns.toLocaleString("pt-BR"), sub: "na plataforma" },
            { label: "Taxa de sucesso", value: `${summary.agentSuccessRate}%`, sub: "agentes completados" },
            { label: "Receita rastreada", value: fmtBRL(summary.totalRevenueBrl), sub: "via webhooks" },
            { label: "Ao vivo agora", value: String(summary.liveCampaigns), sub: "campanhas ativas" },
          ].map(k => (
            <div key={k.label} className="border border-border/30 bg-card/20 px-4 py-3">
              <div className="font-mono font-black text-xl text-primary mb-0.5">{k.value}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">{k.label}</div>
              <div className="font-mono text-[11px] text-muted-foreground/35">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Proof cases */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-widest text-foreground font-bold">
            Cases de Execução
          </h2>
          <span className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
            {cases.length} registros
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-border/20 h-24 animate-pulse bg-muted/10" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map(c => {
              const Icon = CAT_ICONS[c.category] ?? BarChart3;
              const color = CAT_COLORS[c.category] ?? "text-white/60 border-white/10 bg-white/5";
              return (
                <div key={c.id} className="border border-border/30 bg-card/10 p-5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 border flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                          {c.metric}
                        </div>
                        <div className="font-mono font-bold text-sm text-foreground">{c.title}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-mono font-black text-lg leading-none ${
                        c.category === "revenue" ? "text-emerald-400" :
                        c.category === "speed" ? "text-amber-400" :
                        "text-primary"
                      }`}>{c.value}</div>
                    </div>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground/55 leading-relaxed pl-11">
                    {c.detail}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Methodology note */}
      <div className="border border-white/10 bg-white/[0.02] p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary/60" />
          <span className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">Sobre os Dados</span>
        </div>
        <p className="font-mono text-xs text-muted-foreground/55 leading-relaxed">
          Métricas ao vivo são agregadas diretamente do banco de dados da plataforma em tempo real.
          Receita capturada via webhooks de integrações (Hotmart, Kiwify, Stripe) vinculadas a campanhas ativas.
          Taxa de sucesso de agentes calculada sobre execuções completadas vs. tentativas totais.
          Dados não incluem informações de usuários individuais — apenas agregados de plataforma.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link href="/campaigns">
            <Button variant="outline" size="sm"
              className="rounded-none font-mono uppercase text-[11px] tracking-widest gap-2 h-8">
              <Zap className="h-3 w-3" />
              Ver minhas campanhas
            </Button>
          </Link>
          <a href="/plataforma" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm"
              className="rounded-none font-mono uppercase text-[11px] tracking-widest gap-2 h-8 text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              Documento institucional
            </Button>
          </a>
        </div>
      </div>

      {/* CTA */}
      <div className="border border-primary/30 bg-primary/5 p-6 text-center space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary/70">
          Seu próximo lançamento
        </div>
        <p className="font-mono font-black text-lg uppercase tracking-tight text-foreground">
          O que você quer provar para o mercado?
        </p>
        <Link href="/campaigns/new">
          <Button className="rounded-none btn-weapon-primary font-mono uppercase tracking-widest gap-2 h-11 px-8 text-xs font-black">
            <Bot className="h-3.5 w-3.5" />
            Criar campanha
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

    </div>
  );
}
