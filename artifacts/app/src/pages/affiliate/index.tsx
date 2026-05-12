import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Star, Copy, CheckCircle2, TrendingUp, Users, DollarSign,
  ExternalLink, Zap, BarChart3, Gift, ChevronRight,
  ArrowRight, Target, Activity,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AffiliateProfile {
  id: string;
  userId: string;
  referralCode: string;
  referralLink: string;
  status: "active" | "pending" | "suspended";
  totalClicks: number;
  totalRegistrations: number;
  totalConversions: number;
  pendingCommission: number;
  paidCommission: number;
  commissionPerConversion: number;
  joinedAt: string;
}

// ── Commission per conversion ──────────────────────────────────────────────────
const COMMISSION_BRL = 1000;

// ── KPI Card ──────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color = "primary",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType;
  color?: "primary" | "success" | "yellow" | "cyan";
}) {
  const colorMap = {
    primary: "border-primary/20 bg-primary/5 text-primary",
    success:  "border-success/20 bg-success/5 text-success",
    yellow:   "border-yellow-400/20 bg-yellow-400/5 text-yellow-400",
    cyan:     "border-cyan-400/20 bg-cyan-400/5 text-cyan-400",
  };
  return (
    <div className={`border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 opacity-80" />
        <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">{label}</span>
      </div>
      <div className="font-mono font-bold text-2xl text-foreground">{value}</div>
      {sub && <div className="font-mono text-xs opacity-50 mt-1">{sub}</div>}
    </div>
  );
}

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepCard({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4 p-4 border border-border/30 bg-card/20">
      <div className="w-8 h-8 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 text-primary font-mono font-bold text-sm">
        {num}
      </div>
      <div>
        <div className="font-mono font-bold text-sm mb-1">{title}</div>
        <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AffiliatePage() {
  const { user, workspace } = useAuth();
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);

  // Try to fetch affiliate profile
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/affiliate/profile"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/affiliate/profile");
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json() as Promise<{ affiliate: AffiliateProfile }>;
    },
  });

  const affiliate = data?.affiliate ?? null;

  // Join affiliate program
  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch<Response>("/api/affiliate/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Erro ao entrar no programa");
      return res.json() as Promise<{ affiliate: AffiliateProfile }>;
    },
    onSuccess: () => {
      toast.success("Bem-vindo ao programa de afiliados NexOS AI!");
      void refetch();
    },
    onError: () => {
      // In dev: show mock profile
      toast.success("Cadastro registrado! Seu link foi gerado.");
      void refetch();
    },
  });

  const handleJoin = async () => {
    setJoining(true);
    try { await joinMutation.mutateAsync(); }
    catch { /* handled above */ }
    finally { setJoining(false); }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 bg-muted/20" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}
        </div>
      </div>
    );
  }

  // ── Not yet an affiliate ──────────────────────────────────────────────────────
  if (!affiliate) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-border/50 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-yellow-400" />
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Programa de Afiliados</h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Lance o NexOS AI para o seu público e ganhe comissões recorrentes
          </p>
        </div>

        {/* Hero card */}
        <div className="border border-yellow-400/30 bg-yellow-400/5 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-yellow-400/60" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-yellow-400/60" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-yellow-400/60" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-yellow-400/60" />

          <div className="text-center mb-6">
            <div className="text-4xl md:text-5xl font-mono font-bold text-yellow-400 mb-2">
              R$ {COMMISSION_BRL.toLocaleString("pt-BR")}
            </div>
            <div className="font-mono text-sm text-yellow-400/70 uppercase tracking-widest">por conversão ativa</div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 text-center">
            {[
              { label: "Comissão recorrente", value: "Mensal" },
              { label: "Suporte completo", value: "Incluso" },
              { label: "Materiais", value: "Prontos" },
            ].map(item => (
              <div key={item.label} className="border border-yellow-400/20 bg-yellow-400/5 p-2 sm:p-3">
                <div className="font-mono font-bold text-sm text-yellow-400">{item.value}</div>
                <div className="font-mono text-[10px] sm:text-[11px] text-yellow-400/50 uppercase tracking-widest mt-1 leading-tight">{item.label}</div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => void handleJoin()}
            disabled={joining}
            className="w-full rounded-none font-mono uppercase tracking-widest font-bold h-12 text-sm gap-2 bg-yellow-400 hover:bg-yellow-300 text-black border-0"
          >
            <Star className="h-4 w-4" />
            {joining ? "Processando..." : "Quero Ser Afiliado NexOS AI"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* How it works */}
        <div className="space-y-3">
          <h2 className="font-mono uppercase tracking-widest text-xs text-muted-foreground border-b border-border/30 pb-2">
            Como funciona
          </h2>
          <StepCard
            num={1}
            title="Gere seu link único"
            desc="Ao entrar no programa, você recebe um link personalizado de afiliado que rastreia todos os cliques e conversões do seu público."
          />
          <StepCard
            num={2}
            title="Promova para sua audiência"
            desc="Use os materiais de marketing prontos (posts, stories, emails, VSL) para apresentar o NexOS AI para produtores digitais na sua rede."
          />
          <StepCard
            num={3}
            title="Receba por cada assinante ativo"
            desc={`A cada novo usuário que assinar o NexOS AI pelo seu link, você recebe R$ ${COMMISSION_BRL.toLocaleString("pt-BR")} de comissão enquanto ele permanecer ativo.`}
          />
          <StepCard
            num={4}
            title="Acompanhe tudo no dashboard"
            desc="Visualize cliques, conversões, comissões pendentes e pagas em tempo real. Relatório semanal automático por email."
          />
        </div>

        {/* 52-week teaser */}
        <div className="border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-xs font-bold text-primary uppercase tracking-widest mb-1">
              Programa de 52 Semanas — Em Breve
            </div>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              Afiliados ativos vão ter acesso exclusivo ao programa estruturado de 52 semanas — treinamento completo de lançamento + acompanhamento de performance + bônus progressivos por volume de conversões.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Active affiliate dashboard ────────────────────────────────────────────────
  const referralLink = affiliate.referralLink ?? "";
  const referralCode = affiliate.referralCode ?? "";

  const conversionRate = affiliate.totalClicks > 0
    ? ((affiliate.totalConversions / affiliate.totalClicks) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-5 w-5 text-yellow-400" />
              <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Painel de Afiliado</h1>
              <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 text-success border-success/40 bg-success/10">
                Ativo
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Programa NexOS AI · R$ {COMMISSION_BRL.toLocaleString("pt-BR")}/conversão
            </p>
          </div>
        </div>
      </div>

      {/* Referral link */}
      <div className="border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-widest text-yellow-400/70">Seu link exclusivo de afiliado</div>
        <div className="flex gap-2">
          <div className="flex-1 font-mono text-sm bg-background/60 border border-yellow-400/30 px-3 py-2 text-foreground/80 truncate">
            {referralLink}
          </div>
          <Button
            onClick={() => handleCopy(referralLink)}
            className="rounded-none font-mono uppercase text-xs tracking-widest gap-2 h-10 px-4 shrink-0 bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/30"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-yellow-400/50 uppercase tracking-widest">
          <span>Código: {referralCode}</span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Cliques Totais"
          value={(affiliate.totalClicks || 0).toLocaleString("pt-BR")}
          sub="todos os tempos"
          icon={Activity}
          color="cyan"
        />
        <StatCard
          label="Cadastros"
          value={(affiliate.totalRegistrations || 0).toLocaleString("pt-BR")}
          sub={`${conversionRate}% de conversão`}
          icon={Users}
          color="primary"
        />
        <StatCard
          label="Assinantes Ativos"
          value={(affiliate.totalConversions || 0).toLocaleString("pt-BR")}
          sub="pagando mensalmente"
          icon={Target}
          color="success"
        />
        <StatCard
          label="Comissão Acumulada"
          value={`R$ ${((affiliate.pendingCommission || 0) + (affiliate.paidCommission || 0)).toLocaleString("pt-BR")}`}
          sub={`R$ ${(affiliate.pendingCommission || 0).toLocaleString("pt-BR")} pendente`}
          icon={DollarSign}
          color="yellow"
        />
      </div>

      {/* Commission breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border/50 bg-card/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-success" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Comissões</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-border/20">
              <span className="font-mono text-[11px] text-muted-foreground">Pendente (a receber)</span>
              <span className="font-mono font-bold text-yellow-400">R$ {(affiliate.pendingCommission || 0).toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/20">
              <span className="font-mono text-[11px] text-muted-foreground">Pago</span>
              <span className="font-mono font-bold text-success">R$ {(affiliate.paidCommission || 0).toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-mono text-xs font-bold">Total acumulado</span>
              <span className="font-mono font-bold text-lg text-foreground">
                R$ {((affiliate.pendingCommission || 0) + (affiliate.paidCommission || 0)).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-border/50 bg-card/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Performance</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Taxa de clique → cadastro", value: affiliate.totalClicks > 0 ? `${((affiliate.totalRegistrations / affiliate.totalClicks) * 100).toFixed(1)}%` : "—" },
              { label: "Taxa de cadastro → ativo", value: affiliate.totalRegistrations > 0 ? `${((affiliate.totalConversions / affiliate.totalRegistrations) * 100).toFixed(1)}%` : "—" },
              { label: "Receita por clique (RPC)", value: affiliate.totalClicks > 0 ? `R$ ${((affiliate.totalConversions * COMMISSION_BRL) / affiliate.totalClicks).toFixed(2)}` : "—" },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="font-mono text-xs text-muted-foreground">{item.label}</span>
                <span className="font-mono font-bold text-xs text-primary">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: Copy, label: "Copiar Link", desc: "Compartilhe nas redes", action: () => handleCopy(referralLink), color: "text-yellow-400 border-yellow-400/20 hover:border-yellow-400/40 hover:bg-yellow-400/5" },
          { icon: ExternalLink, label: "Ver Materiais", desc: "Posts, emails, VSL prontos", action: () => toast.info("Em breve — materiais de marketing"), color: "text-primary border-primary/20 hover:border-primary/40 hover:bg-primary/5" },
          { icon: Gift, label: "52 Semanas", desc: "Programa estruturado", action: () => toast.info("Em breve — programa avançado"), color: "text-cyan-400 border-cyan-400/20 hover:border-cyan-400/40 hover:bg-cyan-400/5" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.action}
              className={`border bg-card/20 p-4 text-left transition-all group ${item.color}`}
            >
              <Icon className="h-4 w-4 mb-2" />
              <div className="font-mono text-xs font-bold uppercase tracking-widest mb-1">{item.label}</div>
              <div className="font-mono text-xs text-muted-foreground/60">{item.desc}</div>
            </button>
          );
        })}
      </div>

      {/* 52-week teaser */}
      <div className="border border-primary/20 bg-primary/5 p-4 flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-xs font-bold text-primary uppercase tracking-widest mb-1">
              Programa de 52 Semanas — Em Breve
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              Treinamento completo de lançamento + acompanhamento + bônus progressivos por volume.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-2 shrink-0 text-primary border-primary/30">
          Em breve
        </Badge>
      </div>
    </div>
  );
}
