import { useEffect, useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Shield, Zap, TrendingUp, Bot, ChevronRight,
  BarChart3, Clock, Target, Loader2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";

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
  const t = useUiText();
  const { locale } = useUiLocale();
  const numberLocale = intlLocale(locale);
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
       ? `R$${v.toLocaleString(numberLocale, { maximumFractionDigits: 0 })}`
      : "—";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary/70">Self-Proof Engine</span>
        </div>
        <h1 className="font-mono font-black text-2xl uppercase tracking-tight text-foreground">
          {t("NexOS Prova a Si Mesmo", "NexOS Proves Itself", "NexOS lo demuestra")}
        </h1>
        <p className="font-mono text-sm text-muted-foreground/60 leading-relaxed max-w-2xl">
          {t("A plataforma que usa a própria metodologia como vitrine. Métricas reais da execução interna, capturadas em tempo real pelo Self-Proof Engine.", "A platform that showcases its own methodology. Real metrics from internal execution, captured in real time by the Self-Proof Engine.", "Una plataforma que muestra su propia metodología. Métricas reales de ejecución interna, capturadas en tiempo real por Self-Proof Engine.")}
        </p>
      </div>

      {/* Live stats strip */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground/50 font-mono text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("Carregando métricas ao vivo...", "Loading live metrics...", "Cargando métricas en tiempo real...")}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("Campanhas criadas", "Campaigns created", "Campañas creadas"), value: summary.totalCampaigns.toLocaleString(numberLocale), sub: t("na plataforma", "on the platform", "en la plataforma") },
            { label: t("Taxa de sucesso", "Success rate", "Tasa de éxito"), value: `${summary.agentSuccessRate}%`, sub: t("agentes completados", "completed agents", "agentes completados") },
            { label: t("Receita rastreada", "Revenue tracked", "Ingresos registrados"), value: fmtBRL(summary.totalRevenueBrl), sub: t("via webhooks", "via webhooks", "mediante webhooks") },
            { label: t("Ao vivo agora", "Live now", "En curso"), value: String(summary.liveCampaigns), sub: t("campanhas ativas", "active campaigns", "campañas activas") },
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
            {t("Cases de Execução", "Execution Case Studies", "Casos de ejecución")}
          </h2>
          <span className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest">
            {t(`${cases.length} registros`, `${cases.length} records`, `${cases.length} registros`)}
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
          <span className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">{t("Sobre os Dados", "About the Data", "Acerca de los datos")}</span>
        </div>
        <p className="font-mono text-xs text-muted-foreground/55 leading-relaxed">
          {t("Métricas ao vivo são agregadas diretamente do banco de dados da plataforma em tempo real. Receita capturada via webhooks de integrações (Hotmart, Kiwify, Stripe) vinculadas a campanhas ativas. Taxa de sucesso de agentes calculada sobre execuções completadas vs. tentativas totais. Dados não incluem informações de usuários individuais — apenas agregados de plataforma.", "Live metrics are aggregated directly from the platform database in real time. Revenue is captured via webhooks from integrations (Hotmart, Kiwify, Stripe) linked to active campaigns. Agent success rate is calculated from completed executions versus total attempts. Data contains no individual user information — only platform aggregates.", "Las métricas en tiempo real se agregan directamente desde la base de datos de la plataforma. Los ingresos se capturan mediante webhooks de integraciones (Hotmart, Kiwify, Stripe) vinculadas a campañas activas. La tasa de éxito de los agentes se calcula con las ejecuciones completadas frente al total de intentos. Los datos no incluyen información de usuarios individuales, solo agregados de la plataforma.")}
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link href="/campaigns">
            <Button variant="outline" size="sm"
              className="rounded-none font-mono uppercase text-[11px] tracking-widest gap-2 h-8">
              <Zap className="h-3 w-3" />
              {t("Ver minhas campanhas", "View my campaigns", "Ver mis campañas")}
            </Button>
          </Link>
          <a href="/plataforma" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm"
              className="rounded-none font-mono uppercase text-[11px] tracking-widest gap-2 h-8 text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              {t("Documento institucional", "Institutional document", "Documento institucional")}
            </Button>
          </a>
        </div>
      </div>

      {/* CTA */}
      <div className="border border-primary/30 bg-primary/5 p-6 text-center space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary/70">
          {t("Seu próximo lançamento", "Your next launch", "Tu próximo lanzamiento")}
        </div>
        <p className="font-mono font-black text-lg uppercase tracking-tight text-foreground">
          {t("O que você quer provar para o mercado?", "What do you want to prove to the market?", "¿Qué quieres demostrarle al mercado?")}
        </p>
        <Link href="/campaigns/new">
          <Button className="rounded-none btn-weapon-primary font-mono uppercase tracking-widest gap-2 h-11 px-8 text-xs font-black">
            <Bot className="h-3.5 w-3.5" />
            {t("Criar campanha", "Create campaign", "Crear campaña")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

    </div>
  );
}
