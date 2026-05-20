import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Rocket, CheckCircle2, Loader2, X, AlertTriangle,
  Wifi, Link2, Instagram, Facebook, Mail, MessageCircle,
  Tv2, Radio, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCampaignQueryKey } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelStatus = "idle" | "checking" | "connected" | "missing" | "skipped";

interface Channel {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  role: string;
  provider: string;
}

const CHANNELS: Channel[] = [
  { id: "instagram",  name: "Instagram",      icon: Instagram,     color: "#E1306C", role: "Canal principal de distribuição de conteúdo e Stories ativado.",        provider: "instagram" },
  { id: "facebook",   name: "Facebook",        icon: Facebook,      color: "#1877F2", role: "Feed orgânico e grupos de engajamento habilitados.",                     provider: "facebook" },
  { id: "meta_ads",   name: "Meta ADS",        icon: BarChart3,     color: "#0050B3", role: "Estrutura de aquisição paga operacional — campanhas prontas para veicular.", provider: "meta_ads" },
  { id: "tiktok",     name: "TikTok",          icon: Tv2,           color: "#010101", role: "Canal de vídeo curto e distribuição viral habilitado.",                  provider: "tiktok" },
  { id: "whatsapp",   name: "WhatsApp",        icon: MessageCircle, color: "#25D366", role: "Fluxo de retenção e reengajamento habilitado.",                         provider: "whatsapp_business" },
  { id: "telegram",   name: "Telegram",        icon: Radio,         color: "#0088CC", role: "Canal de comunidade e broadcast ativado.",                              provider: "telegram" },
  { id: "email",      name: "E-mail Marketing", icon: Mail,         color: "#F59E0B", role: "Sequência de nutrição e follow-up operacional.",                         provider: "rd_station" },
];

// ─── Stage types ──────────────────────────────────────────────────────────────
type Stage = "rocket" | "connecting" | "countdown" | "launched";

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  campaignId: string;
  campaignTitle: string;
  connectedProviders: string[];
  onClose: () => void;
}

// ─── Scanline background ──────────────────────────────────────────────────────
function ScanLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)",
          backgroundSize: "100% 4px",
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function LaunchSequenceOverlay({ campaignId, campaignTitle, connectedProviders, onClose }: Props) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>("rocket");
  const [channelStatuses, setChannelStatuses] = useState<Record<string, ChannelStatus>>({});
  const [currentChannelIdx, setCurrentChannelIdx] = useState(-1);
  const [countdown, setCountdown] = useState(5);
  const [launching, setLaunching] = useState(false);
  const [apiCalled, setApiCalled] = useState(false);
  const launched = useRef(false);

  // ── Call the actual launch API ─────────────────────────────────────────────
  const triggerLaunch = useCallback(async () => {
    if (apiCalled) return;
    setApiCalled(true);
    try {
      await customFetch(`/api/campaigns/${campaignId}/execute/launch?skipIntegrationWarning=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    } catch (err) {
      const e = err as { data?: { error?: string } } | Error;
      const msg = ("data" in e && e.data?.error) || (e instanceof Error ? e.message : "Erro ao lançar campanha");
      toast.error(msg, { duration: 8000 });
    }
  }, [apiCalled, campaignId, queryClient]);

  // ── Animate channel checks ──────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "connecting") return;

    let idx = 0;
    const init: Record<string, ChannelStatus> = {};
    CHANNELS.forEach(c => { init[c.id] = "idle"; });
    setChannelStatuses(init);
    setCurrentChannelIdx(0);

    const runNext = () => {
      if (idx >= CHANNELS.length) {
        // All done → countdown
        setTimeout(() => setStage("countdown"), 600);
        return;
      }
      const ch = CHANNELS[idx]!;
      setCurrentChannelIdx(idx);
      setChannelStatuses(prev => ({ ...prev, [ch.id]: "checking" }));

      const delay = 900 + Math.random() * 400;
      setTimeout(() => {
        const isConnected = connectedProviders.includes(ch.provider);
        setChannelStatuses(prev => ({
          ...prev,
          [ch.id]: isConnected ? "connected" : "missing",
        }));
        idx++;
        setTimeout(runNext, 350);
      }, delay);
    };

    const startTimer = setTimeout(runNext, 400);
    return () => clearTimeout(startTimer);
  }, [stage, connectedProviders]);

  // ── Countdown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "countdown") return;
    void triggerLaunch();
    let n = 5;
    setCountdown(n);
    const iv = setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(iv);
        setStage("launched");
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [stage, triggerLaunch]);

  // ── After "launched" → go to dashboard ─────────────────────────────────────
  useEffect(() => {
    if (stage !== "launched" || launched.current) return;
    launched.current = true;
    const timer = setTimeout(() => {
      setLocation("/");
      onClose();
    }, 3200);
    return () => clearTimeout(timer);
  }, [stage, setLocation, onClose]);

  // ── Skip a missing channel ──────────────────────────────────────────────────
  const skipChannel = (id: string) => {
    setChannelStatuses(prev => ({ ...prev, [id]: "skipped" }));
  };

  const connectedCount = Object.values(channelStatuses).filter(s => s === "connected").length;
  const allResolved = Object.values(channelStatuses).length === CHANNELS.length &&
    Object.values(channelStatuses).every(s => s === "connected" || s === "skipped" || s === "missing");
  const hasMissing = Object.values(channelStatuses).some(s => s === "missing");

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
      <ScanLines />

      {/* Corner brackets */}
      {["top-4 left-4 border-t border-l", "top-4 right-4 border-t border-r", "bottom-4 left-4 border-b border-l", "bottom-4 right-4 border-b border-r"].map((cls, i) => (
        <div key={i} className={`absolute w-6 h-6 border-white/20 ${cls}`} />
      ))}

      {/* Close (only in rocket stage) */}
      {stage === "rocket" && (
        <button onClick={onClose} className="absolute top-5 right-5 text-white/30 hover:text-white/70 transition-colors z-10">
          <X className="h-5 w-5" />
        </button>
      )}

      {/* ── STAGE: ROCKET BUTTON ── */}
      {stage === "rocket" && (
        <div className="flex flex-col items-center gap-10 px-6 text-center max-w-lg">
          <div className="space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-white/25">
              Autorização Operacional · NexOS AI
            </div>
            <h1 className="font-mono font-black text-3xl md:text-5xl uppercase tracking-tighter text-white leading-none">
              Campanha<br />
              <span className="text-transparent" style={{ WebkitTextStroke: "1px rgba(255,255,255,0.4)" }}>
                {campaignTitle}
              </span>
            </h1>
            <p className="font-mono text-xs text-white/30 leading-relaxed">
              Todos os ativos estão aprovados.<br />
              Ao lançar, a NexOS AI assume o comando operacional completo.
            </p>
          </div>

          {/* Rocket button */}
          <button
            onClick={() => { setLaunching(true); setTimeout(() => { setLaunching(false); setStage("connecting"); }, 600); }}
            disabled={launching}
            className="group relative"
          >
            {/* Outer ring */}
            <div className="absolute -inset-6 rounded-full border border-white/5 animate-ping opacity-30" style={{ animationDuration: "3s" }} />
            <div className="absolute -inset-4 rounded-full border border-white/10 animate-ping opacity-20" style={{ animationDuration: "2.2s" }} />

            <div
              className={`relative w-40 h-40 rounded-full border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300 cursor-pointer
                ${launching ? "scale-95 opacity-70" : "hover:scale-105 active:scale-95"}
              `}
              style={{
                borderColor: "rgba(255,255,255,0.3)",
                background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.6) 100%)",
                boxShadow: launching ? "0 0 60px rgba(255,255,255,0.1)" : "0 0 40px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <Rocket className={`h-10 w-10 text-white transition-transform ${launching ? "translate-y-[-4px]" : "group-hover:translate-y-[-3px]"}`} style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.5))" }} />
              <div className="font-mono font-black text-sm uppercase tracking-[0.15em] text-white leading-none">
                Lançar<br />
                <span className="text-white/60 text-[10px]">Agora</span>
              </div>
            </div>
          </button>

          <p className="font-mono text-[10px] text-white/20 uppercase tracking-widest">
            Esta ação é irreversível. A operação começa imediatamente.
          </p>
        </div>
      )}

      {/* ── STAGE: CONNECTING ── */}
      {stage === "connecting" && (
        <div className="w-full max-w-lg px-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/25">
              Verificando Conexões Operacionais
            </div>
            <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-white">
              Sincronizando Canais
            </h2>
          </div>

          {/* Progress bar */}
          <div className="h-px bg-white/10 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-white/40 transition-all duration-500"
              style={{ width: `${(connectedCount / CHANNELS.length) * 100}%` }}
            />
          </div>

          {/* Channels list */}
          <div className="space-y-2">
            {CHANNELS.map((ch, i) => {
              const Icon = ch.icon;
              const status = channelStatuses[ch.id] ?? "idle";
              const isActive = i === currentChannelIdx;

              return (
                <div
                  key={ch.id}
                  className={`flex items-start gap-3 px-4 py-3 border transition-all duration-300 ${
                    status === "connected" ? "border-green-500/30 bg-green-500/5" :
                    status === "missing" ? "border-white/10 bg-white/[0.02]" :
                    status === "skipped" ? "border-white/5 opacity-40" :
                    isActive ? "border-white/20 bg-white/[0.04]" :
                    "border-white/5 opacity-30"
                  }`}
                >
                  <div className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: status === "idle" || status === "skipped" ? "rgba(255,255,255,0.05)" : `${ch.color}22`, border: `1px solid ${ch.color}44` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: status === "idle" || status === "skipped" ? "rgba(255,255,255,0.2)" : ch.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-white/80 uppercase tracking-widest">{ch.name}</span>
                      <div className="shrink-0">
                        {status === "checking" && <Loader2 className="h-3.5 w-3.5 text-white/40 animate-spin" />}
                        {status === "connected" && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
                        {status === "skipped" && <span className="font-mono text-[10px] uppercase tracking-widest text-white/20">Ignorado</span>}
                      </div>
                    </div>

                    {status === "connected" && (
                      <p className="font-mono text-[10px] text-green-400/60 mt-0.5 leading-relaxed">{ch.role}</p>
                    )}

                    {status === "missing" && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <AlertTriangle className="h-3 w-3 text-yellow-400/60 shrink-0" />
                        <span className="font-mono text-[10px] text-white/30 flex-1">Não conectado</span>
                        <button
                          onClick={() => skipChannel(ch.id)}
                          className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 border border-white/10 hover:border-white/25 px-2 py-0.5 transition-all"
                        >
                          Ignorar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* If all resolved and has missing — allow proceeding */}
          {allResolved && hasMissing && (
            <div className="border border-yellow-400/20 bg-yellow-400/5 p-4 space-y-3">
              <p className="font-mono text-xs text-yellow-400/70 leading-relaxed">
                Alguns canais não estão conectados. A operação continuará com cobertura reduzida. Canais ausentes não receberão disparo automático.
              </p>
              <Button
                className="w-full font-mono uppercase tracking-widest rounded-none h-10 gap-2 text-xs"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
                onClick={() => setStage("countdown")}
              >
                <Rocket className="h-4 w-4" />Prosseguir e Lançar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── STAGE: COUNTDOWN ── */}
      {stage === "countdown" && (
        <div className="flex flex-col items-center gap-8 text-center px-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-white/25">
            Iniciando operação autônoma
          </div>

          {/* Countdown number */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-white/10 animate-ping opacity-20" style={{ animationDuration: "1s" }} />
            <div className="absolute inset-2 rounded-full border border-white/5" />
            <div
              className="font-mono font-black text-white leading-none transition-all"
              style={{
                fontSize: countdown > 0 ? "7rem" : "4rem",
                textShadow: "0 0 40px rgba(255,255,255,0.3)",
                letterSpacing: "-0.05em",
              }}
            >
              {countdown > 0 ? countdown : "GO"}
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-mono text-sm text-white/40 uppercase tracking-widest">
              {countdown > 3 ? "Preparando distribuição..." : countdown > 1 ? "Ativando agentes..." : countdown === 1 ? "Iniciando..." : "Operação iniciada!"}
            </p>
            <div className="flex gap-1 justify-center">
              {[5, 4, 3, 2, 1].map(n => (
                <div key={n} className={`w-2 h-2 rounded-full transition-all duration-300 ${countdown < n ? "bg-white opacity-80" : "bg-white/15"}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: LAUNCHED ── */}
      {stage === "launched" && (
        <div className="flex flex-col items-center gap-8 text-center px-6">
          <div className="relative">
            <div className="absolute -inset-8 rounded-full animate-ping opacity-10 bg-white" style={{ animationDuration: "1.5s" }} />
            <div className="absolute -inset-4 rounded-full animate-ping opacity-15 bg-white" style={{ animationDuration: "1s" }} />
            <CheckCircle2 className="h-20 w-20 text-white" style={{ filter: "drop-shadow(0 0 24px rgba(255,255,255,0.6))" }} />
          </div>

          <div className="space-y-3">
            <div className="font-mono font-black text-4xl md:text-6xl uppercase tracking-tighter text-white" style={{ textShadow: "0 0 40px rgba(255,255,255,0.3)" }}>
              Lançado
            </div>
            <p className="font-mono text-sm text-white/40 uppercase tracking-[0.2em]">
              A operação autônoma está em andamento
            </p>
          </div>

          <div className="flex flex-col gap-1.5 items-center">
            {CHANNELS.filter(c => channelStatuses[c.id] === "connected").map(ch => {
              const Icon = ch.icon;
              return (
                <div key={ch.id} className="flex items-center gap-2 font-mono text-[11px] text-white/30 uppercase tracking-widest">
                  <Wifi className="h-3 w-3" style={{ color: ch.color, opacity: 0.7 }} />
                  <Icon className="h-3 w-3" style={{ color: ch.color, opacity: 0.7 }} />
                  <span>{ch.name} operacional</span>
                </div>
              );
            })}
          </div>

          <p className="font-mono text-[11px] text-white/20 uppercase tracking-widest animate-pulse">
            Redirecionando para o painel de controle...
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Trigger button (rendered in the campaign detail page) ────────────────────
interface TriggerProps {
  onClick: () => void;
  loading?: boolean;
}

export function LaunchRocketButton({ onClick, loading }: TriggerProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="group relative flex items-center gap-3 px-8 py-4 font-mono font-black text-sm uppercase tracking-[0.2em] text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)",
          border: "1px solid rgba(255,255,255,0.25)",
          boxShadow: "0 0 24px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        {loading
          ? <Loader2 className="h-5 w-5 animate-spin" />
          : <Rocket className="h-5 w-5 group-hover:translate-y-[-2px] transition-transform" style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))" }} />
        }
        Lançar Agora
      </button>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30">
        Todos os ativos aprovados · Autorização pendente
      </p>
    </div>
  );
}
