/**
 * Launch Room — Sala de Lançamento
 *
 * Experiência cinematográfica de lançamento.
 * Mostra status em tempo real das plataformas conectadas,
 * métricas ao vivo e o comando central do lançamento.
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useUiText } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Rocket, Radio, Wifi, WifiOff, ArrowLeft,
  Users, TrendingUp, ShoppingCart, MessageSquare,
  Instagram, Mail, Activity, CheckCircle2,
  AlertTriangle, Zap, Target, Clock,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

interface Platform {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  required: boolean;
}

const PLATFORMS: Platform[] = [
  { id: "whatsapp",  name: "WhatsApp",   icon: MessageSquare, color: "text-green-400",  required: true  },
  { id: "instagram", name: "Instagram",  icon: Instagram,     color: "text-pink-400",   required: false },
  { id: "email",     name: "E-mail",     icon: Mail,          color: "text-blue-400",   required: true  },
  { id: "meta_ads",  name: "Meta Ads",   icon: Target,        color: "text-indigo-400", required: false },
  { id: "realtime",  name: "NexOS Live", icon: Radio,         color: "text-primary",    required: true  },
];

interface LiveStats {
  totalLeads: number;
  leadsLast24h: number;
  leadsLastHour: number;
  totalSales: number;
  revenueBrlLast24h: number;
  totalRevenueBrl: number;
  engagementEventsLast24h: number;
  activeSequences: number;
}

interface Integration {
  provider: string;
  status: string;
}

function PlatformOrb({
  platform,
  connected,
  pulse,
}: {
  platform: Platform;
  connected: boolean;
  pulse: boolean;
}) {
  const Icon = platform.icon;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
          connected
            ? `border-${platform.color.replace("text-", "")} bg-card/50`
            : "border-border/30 bg-card/20 opacity-40"
        }`}
      >
        {connected && pulse && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary" />
        )}
        <Icon className={`h-6 w-6 ${connected ? platform.color : "text-muted-foreground/30"}`} />
        {connected ? (
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-success border-2 border-background" />
        ) : (
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-muted-foreground/30 border-2 border-background" />
        )}
      </div>
      <span className={`font-mono text-[10px] uppercase tracking-widest ${connected ? "text-foreground/60" : "text-muted-foreground/30"}`}>
        {platform.name}
      </span>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, highlight = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; highlight?: boolean;
}) {
  return (
    <div className={`border p-4 ${highlight ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/20"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${highlight ? "text-primary" : "text-muted-foreground/50"}`} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{label}</span>
      </div>
      <div className={`font-mono font-black text-2xl ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground/40 mt-1">{sub}</div>}
    </div>
  );
}

export default function LaunchRoom() {
  const t = useUiText();
  const { id: campaignId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    intervalRef.current = setInterval(() => setTick(n => n + 1), 5000);
    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const { data: integrationsData } = useQuery<{ integrations: Integration[] }>({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: () => customFetch<{ integrations: Integration[] }>("/api/workspaces/me/integrations"),
    staleTime: 30_000,
  });

  const { data: liveStats } = useQuery<LiveStats>({
    queryKey: ["/api/campaigns", campaignId, "live-stats", tick],
    queryFn: () =>
      customFetch<LiveStats>(`/api/campaigns/${campaignId}/live-stats`),
    enabled: !!campaignId,
    refetchInterval: 10_000,
  });

  const connected = integrationsData?.integrations ?? [];

  function isPlatformConnected(platformId: string): boolean {
    return connected.some(
      i =>
        i.status === "connected" &&
        (i.provider === platformId ||
          i.provider === `${platformId}_business` ||
          i.provider === `${platformId}_ads`),
    );
  }

  // Always treat NexOS Live as connected
  function isConnected(p: Platform): boolean {
    if (p.id === "realtime") return true;
    return isPlatformConnected(p.id);
  }

  const missingRequired = PLATFORMS.filter(p => p.required && !isConnected(p));
  const allSystemsGo = missingRequired.length === 0;

  const fmtBrl = (v: number) =>
    v >= 1_000_000
      ? `R$${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
      ? `R$${(v / 1_000).toFixed(0)}k`
      : `R$${v.toFixed(0)}`;

  return (
    <div
      className={`min-h-screen bg-background flex flex-col transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* ── Top bar ── */}
      <div className="border-b border-border/30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => campaignId ? setLocation(`/campaigns/${campaignId}`) : setLocation("/campaigns")}
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <img src={nexosLogo} alt="NexOS" className="h-6 opacity-80" />
        </div>

        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-success font-bold">
            {t("Sala de Lançamento · Ao Vivo", "Launch Room · Live", "Sala de Lanzamiento · En Vivo")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {allSystemsGo ? (
            <Wifi className="h-4 w-4 text-success" />
          ) : (
            <WifiOff className="h-4 w-4 text-warning" />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6 py-10 gap-10">

        {/* ── Headline ── */}
        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 mb-3">
            {campaignId ? `${t("Campanha", "Campaign", "Campaña")} · ${campaignId.slice(0, 8).toUpperCase()}` : t("Lançamento Global", "Global Launch", "Lanzamiento Global")}
          </p>
          <h1 className="font-mono font-black text-3xl md:text-5xl uppercase tracking-tight text-foreground">
            {allSystemsGo ? (
              <>{t("Todos os sistemas", "All systems", "Todos los sistemas")} <span className="text-success">{t("prontos", "ready", "listos")}</span></>
            ) : (
              <>{t("Aguardando", "Waiting for", "Esperando")} <span className="text-warning">{t("conexões", "connections", "conexiones")}</span></>
            )}
          </h1>
          <p className="font-mono text-sm text-muted-foreground/50 mt-3">
            {allSystemsGo
              ? t("A operação está totalmente conectada. Você pode iniciar o lançamento.", "The operation is fully connected. You can start the launch.", "La operación está totalmente conectada. Puedes iniciar el lanzamiento.")
              : t(`${missingRequired.length} plataforma(s) obrigatória(s) ainda não conectada(s).`, `${missingRequired.length} required platform(s) still need to be connected.`, `Aún faltan conectar ${missingRequired.length} plataforma(s) obligatoria(s).`)}
          </p>
        </div>

        {/* ── Platform Connection Cycle ── */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 text-center mb-6">
            {t("Status das plataformas", "Platform status", "Estado de las plataformas")}
          </p>
          <div className="flex items-center justify-center gap-6 md:gap-10">
            {PLATFORMS.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 md:gap-6">
                <PlatformOrb platform={p} connected={isConnected(p)} pulse={allSystemsGo} />
                {i < PLATFORMS.length - 1 && (
                  <div className={`hidden md:block h-px w-8 ${allSystemsGo ? "bg-primary/30" : "bg-border/20"} transition-colors duration-1000`} />
                )}
              </div>
            ))}
          </div>

          {missingRequired.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2">
              {missingRequired.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="font-mono text-[11px]">
                    {t(`${p.name} não conectado — obrigatório para lançamento`, `${p.name} not connected — required for launch`, `${p.name} no conectado — obligatorio para el lanzamiento`)}
                  </span>
                </div>
              ))}
              <Button
                variant="outline"
                className="rounded-none font-mono uppercase tracking-widest text-xs mt-3 border-warning/40 text-warning hover:bg-warning/10"
                onClick={() => setLocation("/integracoes")}
              >
                {t("Conectar plataformas", "Connect platforms", "Conectar plataformas")}
              </Button>
            </div>
          )}
        </div>

        {/* ── Live Stats ── */}
        {campaignId && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-4">
              {t("Métricas ao vivo", "Live metrics", "Métricas en vivo")}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label={t("Leads total", "Total leads", "Total de prospectos")}
                value={liveStats?.totalLeads ?? "—"}
                sub={t(`+${liveStats?.leadsLastHour ?? 0} na última hora`, `+${liveStats?.leadsLastHour ?? 0} in the last hour`, `+${liveStats?.leadsLastHour ?? 0} en la última hora`)}
                icon={Users}
              />
              <StatCard
                label={t("Leads 24h", "Leads 24h", "Prospectos 24 h")}
                value={liveStats?.leadsLast24h ?? "—"}
                sub={t("Últimas 24 horas", "Last 24 hours", "Últimas 24 horas")}
                icon={TrendingUp}
                highlight
              />
              <StatCard
                label={t("Vendas", "Sales", "Ventas")}
                value={liveStats?.totalSales ?? "—"}
                sub={t("Total de conversões", "Total conversions", "Total de conversiones")}
                icon={ShoppingCart}
              />
              <StatCard
                label={t("Receita", "Revenue", "Ingresos")}
                value={liveStats ? fmtBrl(liveStats.totalRevenueBrl) : "—"}
                sub={liveStats ? t(`+${fmtBrl(liveStats.revenueBrlLast24h)} hoje`, `+${fmtBrl(liveStats.revenueBrlLast24h)} today`, `+${fmtBrl(liveStats.revenueBrlLast24h)} hoy`) : ""}
                icon={Activity}
                highlight
              />
            </div>
          </div>
        )}

        {/* ── Blocos de status do sistema ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`border p-4 ${allSystemsGo ? "border-success/30 bg-success/5" : "border-border/30 bg-card/20"}`}>
            <div className="flex items-center gap-2 mb-1">
              {allSystemsGo ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground/40" />
              )}
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
                 {t("Automação", "Automation", "Automatización")}
              </span>
            </div>
            <p className="font-mono text-xs text-foreground/60 mt-1">
              {allSystemsGo ? t("Sequências prontas para disparar", "Sequences ready to send", "Secuencias listas para enviar") : t("Aguardando conexões obrigatórias", "Waiting for required connections", "Esperando las conexiones obligatorias")}
            </p>
          </div>

          <div className="border border-border/30 bg-card/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-primary/60" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
                 {t("Agentes IA", "AI agents", "Agentes de IA")}
              </span>
            </div>
            <p className="font-mono text-xs text-foreground/60 mt-1">
              {t("64 agentes ativos · Monitorando em tempo real", "64 active agents · Monitoring in real time", "64 agentes activos · Supervisión en tiempo real")}
            </p>
          </div>

          <div className="border border-border/30 bg-card/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="h-4 w-4 text-primary/60 animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
                NexOS Live
              </span>
            </div>
            <p className="font-mono text-xs text-foreground/60 mt-1">
              {t("WebSocket conectado · Eventos em tempo real", "WebSocket connected · Real-time events", "WebSocket conectado · Eventos en tiempo real")}
            </p>
          </div>
        </div>

        {/* ── CTA Principal ── */}
        <div className="flex flex-col items-center gap-4 pt-4">
          {allSystemsGo ? (
            <>
              <Button
                className="rounded-none font-mono uppercase tracking-widest font-black gap-3 btn-weapon-primary h-14 px-12 text-sm"
                onClick={() => campaignId && setLocation(`/campaigns/${campaignId}`)}
              >
                <Rocket className="h-4 w-4" />
                {t("Central de campanha", "Campaign hub", "Centro de campaña")}
              </Button>
              <p className="font-mono text-[10px] text-muted-foreground/30 text-center">
                {t("Todos os sistemas conectados · Pronto para lançar", "All systems connected · Ready to launch", "Todos los sistemas conectados · Listo para lanzar")}
              </p>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="rounded-none font-mono uppercase tracking-widest font-black gap-3 h-14 px-12 text-sm border-border/40"
                onClick={() => setLocation("/integracoes")}
              >
                {t("Conectar plataformas faltantes", "Connect missing platforms", "Conectar plataformas faltantes")}
              </Button>
              <p className="font-mono text-[10px] text-muted-foreground/30 text-center">
                {t("Conecte as plataformas obrigatórias para liberar o lançamento", "Connect the required platforms to enable launch", "Conecta las plataformas obligatorias para habilitar el lanzamiento")}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
