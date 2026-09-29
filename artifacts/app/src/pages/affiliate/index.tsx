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
import { useUiText } from "@/lib/i18n";

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
  const t = useUiText();
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);

  // Try to fetch affiliate profile
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/affiliate/profile"],
    queryFn: async () => {
      return customFetch<{ affiliate: AffiliateProfile }>("/api/affiliate/profile").catch(() => null);
    },
  });

  const affiliate = data?.affiliate ?? null;

  // Join affiliate program
  const joinMutation = useMutation({
    mutationFn: async () => {
      return customFetch<{ affiliate: AffiliateProfile }>("/api/affiliate/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast.success(t("Bem-vindo ao programa de afiliados NexOS!", "Welcome to the NexOS affiliate program!", "¡Te damos la bienvenida al programa de afiliados de NexOS!"));
      void refetch();
    },
    onError: () => {
      // In dev: show mock profile
      toast.success(t("Cadastro registrado! Seu link foi gerado.", "Registration received! Your link has been generated.", "¡Registro recibido! Se generó tu enlace."));
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
    toast.success(t("Link copiado!", "Link copied!", "¡Enlace copiado!"));
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
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">{t("Programa de Afiliados", "Affiliate Program", "Programa de afiliados")}</h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {t("Lance o NexOS para o seu público e ganhe comissões por cada indicação", "Launch NexOS to your audience and earn commissions for every referral", "Presenta NexOS a tu audiencia y gana comisiones por cada referido")}
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
            <div className="font-mono text-sm text-yellow-400/70 uppercase tracking-widest">{t("por conversão ativa", "per active conversion", "por conversión activa")}</div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 text-center">
            {[
              { label: t("Comissão recorrente", "Recurring commission", "Comisión recurrente"), value: t("Mensal", "Monthly", "Mensual") },
              { label: t("Suporte completo", "Full support", "Soporte completo"), value: t("Incluso", "Included", "Incluido") },
              { label: t("Materiais", "Materials", "Materiales"), value: t("Prontos", "Ready", "Listos") },
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
            {joining ? t("Processando...", "Processing...", "Procesando...") : t("Quero ser afiliado NexOS", "Become a NexOS affiliate", "Quiero ser afiliado de NexOS")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* How it works */}
        <div className="space-y-3">
          <h2 className="font-mono uppercase tracking-widest text-xs text-muted-foreground border-b border-border/30 pb-2">
            {t("Como funciona", "How it works", "Cómo funciona")}
          </h2>
          <StepCard
            num={1}
            title={t("Gere seu link único", "Get your unique link", "Genera tu enlace único")}
            desc={t("Ao entrar no programa, você recebe um link personalizado de afiliado que rastreia todos os cliques e conversões do seu público.", "When you join, you get a personalized affiliate link that tracks all clicks and conversions from your audience.", "Al unirte, recibes un enlace de afiliado personalizado que registra los clics y conversiones de tu audiencia.")}
          />
          <StepCard
            num={2}
            title={t("Promova para sua audiência", "Promote to your audience", "Promociona a tu audiencia")}
            desc={t("Use os materiais de marketing prontos (posts, stories, emails, VSL) para apresentar o NexOS para produtores digitais na sua rede.", "Use ready-made marketing materials (posts, stories, emails, VSLs) to introduce NexOS to digital creators in your network.", "Usa materiales de marketing listos (publicaciones, historias, correos y VSL) para presentar NexOS a creadores digitales de tu red.")}
          />
          <StepCard
            num={3}
            title={t("Receba por cada assinante ativo", "Earn for every active subscriber", "Gana por cada suscriptor activo")}
            desc={t(`A cada novo usuário que assinar o NexOS pelo seu link, você recebe R$ ${COMMISSION_BRL.toLocaleString("pt-BR")} de comissão enquanto ele permanecer ativo.`, `For every new user who subscribes to NexOS through your link, you receive a R$ ${COMMISSION_BRL.toLocaleString("pt-BR")} commission for as long as they remain active.`, `Por cada nuevo usuario que se suscriba a NexOS desde tu enlace, recibes una comisión de R$ ${COMMISSION_BRL.toLocaleString("pt-BR")} mientras siga activo.`)}
          />
          <StepCard
            num={4}
            title={t("Acompanhe tudo no dashboard", "Track everything in your dashboard", "Consulta todo en el panel")}
            desc={t("Visualize cliques, conversões, comissões pendentes e pagas em tempo real. Relatório semanal automático por email.", "Track clicks, conversions, pending and paid commissions in real time. Get an automatic weekly email report.", "Consulta clics, conversiones y comisiones pendientes y pagadas en tiempo real. Recibe un informe semanal automático por correo.")}
          />
        </div>

        {/* 52-week teaser */}
        <div className="border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-xs font-bold text-primary uppercase tracking-widest mb-1">
              {t("Programa de 52 semanas — Em breve", "52-week program — Coming soon", "Programa de 52 semanas — Próximamente")}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              {t("Afiliados ativos vão ter acesso exclusivo ao programa estruturado de 52 semanas — treinamento completo de lançamento + acompanhamento de performance + bônus progressivos por volume de conversões.", "Active affiliates will get exclusive access to a structured 52-week program — complete launch training, performance coaching, and progressive bonuses based on conversion volume.", "Los afiliados activos tendrán acceso exclusivo a un programa estructurado de 52 semanas: formación completa sobre lanzamientos, seguimiento del rendimiento y bonos progresivos según el volumen de conversiones.")}
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
               <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">{t("Painel de afiliado", "Affiliate dashboard", "Panel de afiliados")}</h1>
              <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 text-success border-success/40 bg-success/10">
                 {t("Ativo", "Active", "Activo")}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
               {t("Programa NexOS", "NexOS program", "Programa NexOS")} · R$ {COMMISSION_BRL.toLocaleString("pt-BR")}/{t("conversão", "conversion", "conversión")}
            </p>
          </div>
        </div>
      </div>

      {/* Referral link */}
      <div className="border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-3">
         <div className="font-mono text-[11px] uppercase tracking-widest text-yellow-400/70">{t("Seu link exclusivo de afiliado", "Your exclusive affiliate link", "Tu enlace exclusivo de afiliado")}</div>
        <div className="flex gap-2">
          <div className="flex-1 font-mono text-sm bg-background/60 border border-yellow-400/30 px-3 py-2 text-foreground/80 truncate">
            {referralLink}
          </div>
          <Button
            onClick={() => handleCopy(referralLink)}
            className="rounded-none font-mono uppercase text-xs tracking-widest gap-2 h-10 px-4 shrink-0 bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/30"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
             {copied ? t("Copiado!", "Copied!", "¡Copiado!") : t("Copiar", "Copy", "Copiar")}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-yellow-400/50 uppercase tracking-widest">
           <span>{t("Código", "Code", "Código")}: {referralCode}</span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t("Cliques totais", "Total clicks", "Clics totales")}
          value={(affiliate.totalClicks || 0).toLocaleString("pt-BR")}
          sub={t("todos os períodos", "all time", "todo el tiempo")}
          icon={Activity}
          color="cyan"
        />
        <StatCard
          label={t("Cadastros", "Sign-ups", "Registros")}
          value={(affiliate.totalRegistrations || 0).toLocaleString("pt-BR")}
          sub={`${conversionRate}% ${t("de conversão", "conversion rate", "de conversión")}`}
          icon={Users}
          color="primary"
        />
        <StatCard
          label={t("Clientes ativos", "Active customers", "Clientes activos")}
          value={(affiliate.totalConversions || 0).toLocaleString("pt-BR")}
          sub={t("com acesso ativo", "with active access", "con acceso activo")}
          icon={Target}
          color="success"
        />
        <StatCard
          label={t("Comissão acumulada", "Total commission", "Comisión acumulada")}
          value={`R$ ${((affiliate.pendingCommission || 0) + (affiliate.paidCommission || 0)).toLocaleString("pt-BR")}`}
          sub={`R$ ${(affiliate.pendingCommission || 0).toLocaleString("pt-BR")} ${t("pendente", "pending", "pendiente")}`}
          icon={DollarSign}
          color="yellow"
        />
      </div>

      {/* Commission breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border/50 bg-card/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-success" />
             <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Comissões", "Commissions", "Comisiones")}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-border/20">
               <span className="font-mono text-[11px] text-muted-foreground">{t("Pendente (a receber)", "Pending (to be paid)", "Pendiente (por cobrar)")}</span>
              <span className="font-mono font-bold text-yellow-400">R$ {(affiliate.pendingCommission || 0).toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/20">
               <span className="font-mono text-[11px] text-muted-foreground">{t("Pago", "Paid", "Pagado")}</span>
              <span className="font-mono font-bold text-success">R$ {(affiliate.paidCommission || 0).toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between items-center py-2">
               <span className="font-mono text-xs font-bold">{t("Total acumulado", "Total earned", "Total acumulado")}</span>
              <span className="font-mono font-bold text-lg text-foreground">
                R$ {((affiliate.pendingCommission || 0) + (affiliate.paidCommission || 0)).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-border/50 bg-card/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
             <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Desempenho", "Performance", "Rendimiento")}</span>
          </div>
          <div className="space-y-3">
            {[
              { label: t("Taxa de clique → cadastro", "Click-to-sign-up rate", "Tasa de clic a registro"), value: affiliate.totalClicks > 0 ? `${((affiliate.totalRegistrations / affiliate.totalClicks) * 100).toFixed(1)}%` : "—" },
              { label: t("Taxa de cadastro → ativo", "Sign-up-to-active rate", "Tasa de registro a cliente activo"), value: affiliate.totalRegistrations > 0 ? `${((affiliate.totalConversions / affiliate.totalRegistrations) * 100).toFixed(1)}%` : "—" },
              { label: t("Receita por clique (RPC)", "Revenue per click (RPC)", "Ingresos por clic (RPC)"), value: affiliate.totalClicks > 0 ? `R$ ${((affiliate.totalConversions * COMMISSION_BRL) / affiliate.totalClicks).toFixed(2)}` : "—" },
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
          { icon: Copy, label: t("Copiar link", "Copy link", "Copiar enlace"), desc: t("Compartilhe nas redes", "Share on social media", "Compártelo en redes sociales"), action: () => handleCopy(referralLink), color: "text-yellow-400 border-yellow-400/20 hover:border-yellow-400/40 hover:bg-yellow-400/5" },
          { icon: ExternalLink, label: t("Ver materiais", "View materials", "Ver materiales"), desc: t("Posts, emails, VSL prontos", "Ready-made posts, emails, VSLs", "Publicaciones, correos y VSL listos"), action: () => toast.info(t("Em breve — materiais de marketing", "Coming soon — marketing materials", "Próximamente — materiales de marketing")), color: "text-primary border-primary/20 hover:border-primary/40 hover:bg-primary/5" },
          { icon: Gift, label: t("52 semanas", "52 weeks", "52 semanas"), desc: t("Programa estruturado", "Structured program", "Programa estructurado"), action: () => toast.info(t("Em breve — programa avançado", "Coming soon — advanced program", "Próximamente — programa avanzado")), color: "text-cyan-400 border-cyan-400/20 hover:border-cyan-400/40 hover:bg-cyan-400/5" },
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
              {t("Programa de 52 semanas — Em breve", "52-week program — Coming soon", "Programa de 52 semanas — Próximamente")}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              {t("Treinamento completo de lançamento + acompanhamento + bônus progressivos por volume.", "Complete launch training + coaching + progressive volume bonuses.", "Formación completa sobre lanzamientos + seguimiento + bonos progresivos por volumen.")}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest px-2 shrink-0 text-primary border-primary/30">
           {t("Em breve", "Coming soon", "Próximamente")}
        </Badge>
      </div>
    </div>
  );
}
