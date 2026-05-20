import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Rocket, CheckCircle2, Loader2, X, AlertTriangle,
  Wifi, Instagram, Facebook, Mail, MessageCircle,
  Tv2, Radio, BarChart3, Zap, Shield,
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
  { id: "instagram",  name: "Instagram",       icon: Instagram,     color: "#E1306C", role: "Distribuição de conteúdo orgânico e Stories ativada.",                    provider: "instagram"          },
  { id: "facebook",   name: "Facebook",         icon: Facebook,      color: "#1877F2", role: "Feed orgânico e grupos de engajamento habilitados.",                     provider: "facebook"           },
  { id: "meta_ads",   name: "Meta ADS",         icon: BarChart3,     color: "#0050B3", role: "Estrutura de aquisição paga operacional — campanhas prontas para veicular.", provider: "meta_ads"        },
  { id: "tiktok",     name: "TikTok",           icon: Tv2,           color: "#69C9D0", role: "Canal de vídeo curto e distribuição viral habilitado.",                  provider: "tiktok"             },
  { id: "whatsapp",   name: "WhatsApp",         icon: MessageCircle, color: "#25D366", role: "Fluxo de retenção e follow-up automático habilitado.",                   provider: "whatsapp_business"  },
  { id: "telegram",   name: "Telegram",         icon: Radio,         color: "#0088CC", role: "Canal de comunidade e broadcast ativado.",                              provider: "telegram"           },
  { id: "email",      name: "E-mail Marketing", icon: Mail,          color: "#F59E0B", role: "Sequência de nutrição e reengajamento operacional.",                    provider: "rd_station"         },
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
      <div className="absolute inset-0 opacity-[0.012]"
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
  const [quickLaunchConfirm, setQuickLaunchConfirm] = useState(false);
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
      const msg = ("data" in e && e.data?.error) || (e instanceof Error ? e.message : "Erro ao iniciar campanha");
      toast.error(msg, { duration: 8000 });
    }
  }, [apiCalled, campaignId, queryClient]);

  // ── Quick launch (bypass overlay) ──────────────────────────────────────────
  const handleQuickLaunch = async () => {
    setQuickLaunchConfirm(false);
    try {
      await customFetch(`/api/campaigns/${campaignId}/execute/launch?skipIntegrationWarning=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      toast.success("Campanha ativada nos canais aprovados.");
      onClose();
    } catch (err) {
      const e = err as { data?: { error?: string } } | Error;
      const msg = ("data" in e && e.data?.error) || (e instanceof Error ? e.message : "Erro ao iniciar campanha");
      toast.error(msg, { duration: 8000 });
    }
  };

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

  const COUNTDOWN_LABELS: Record<number, string> = {
    5: "Preparando execução operacional...",
    4: "Validando configurações de campanha...",
    3: "Ativando canais aprovados...",
    2: "Sincronizando agentes...",
    1: "Iniciando...",
    0: "Campanha ativada.",
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
      <ScanLines />

      {/* Corner brackets — cockpit aesthetic */}
      {["top-4 left-4 border-t border-l", "top-4 right-4 border-t border-r", "bottom-4 left-4 border-b border-l", "bottom-4 right-4 border-b border-r"].map((cls, i) => (
        <div key={i} className={`absolute w-6 h-6 border-white/15 ${cls}`} />
      ))}

      {/* Close — always visible except countdown/launched */}
      {stage !== "countdown" && stage !== "launched" && (
        <button onClick={onClose} className="absolute top-5 right-5 text-white/25 hover:text-white/60 transition-colors z-10">
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Quick launch confirm mini-modal */}
      {quickLaunchConfirm && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20 p-6">
          <div className="border border-white/15 bg-black w-full max-w-sm p-6 space-y-4">
            <div className="space-y-1.5">
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-white/30">Lançamento Direto</div>
              <h3 className="font-mono text-base font-bold text-white">Ativar campanha agora?</h3>
              <p className="font-mono text-[11px] text-white/40 leading-relaxed">
                A campanha será iniciada nos canais aprovados. Você poderá monitorar e ajustar pelo painel de controle.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 font-mono uppercase tracking-widest rounded-none h-10 text-xs"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
                onClick={() => void handleQuickLaunch()}
              >
                <Zap className="h-3.5 w-3.5 mr-2" />Confirmar
              </Button>
              <Button
                variant="ghost"
                className="font-mono uppercase tracking-widest rounded-none h-10 px-4 text-xs text-white/40 hover:text-white/70"
                onClick={() => setQuickLaunchConfirm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: ROCKET BUTTON ── */}
      {stage === "rocket" && (
        <div className="flex flex-col items-center gap-10 px-6 text-center max-w-lg">
          {/* Supervisor badge */}
          <div className="flex items-center gap-2 border border-white/10 px-4 py-2">
            <Shield className="h-3 w-3 text-white/30" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
              Supervisão Estratégica Ativa
            </span>
          </div>

          <div className="space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-white/20">
              Autorização Operacional · NexOS AI
            </div>
            <h1 className="font-mono font-black text-3xl md:text-4xl uppercase tracking-tighter text-white leading-none">
              {campaignTitle}
            </h1>
            <p className="font-mono text-xs text-white/30 leading-relaxed">
              Todos os ativos foram aprovados por você.<br />
              A campanha será iniciada nos canais autorizados acima.
            </p>
          </div>

          {/* Rocket button */}
          <button
            onClick={() => { setLaunching(true); setTimeout(() => { setLaunching(false); setStage("connecting"); }, 600); }}
            disabled={launching}
            className="group relative"
          >
            <div className="absolute -inset-6 rounded-full border border-white/5 animate-ping opacity-20" style={{ animationDuration: "3s" }} />
            <div className="absolute -inset-4 rounded-full border border-white/8 animate-ping opacity-15" style={{ animationDuration: "2.2s" }} />

            <div
              className={`relative w-36 h-36 rounded-full border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300 cursor-pointer
                ${launching ? "scale-95 opacity-70" : "hover:scale-105 active:scale-95"}`}
              style={{
                borderColor: "rgba(255,255,255,0.25)",
                background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.6) 100%)",
                boxShadow: launching
                  ? "0 0 60px rgba(255,255,255,0.08)"
                  : "0 0 32px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <Rocket
                className={`h-9 w-9 text-white transition-transform ${launching ? "translate-y-[-4px]" : "group-hover:translate-y-[-3px]"}`}
                style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.4))" }}
              />
              <div className="font-mono font-black text-sm uppercase tracking-[0.12em] text-white leading-none">
                Ativar<br />
                <span className="text-white/50 text-[10px]">Campanha</span>
              </div>
            </div>
          </button>

          {/* Operational note */}
          <p className="font-mono text-[10px] text-white/18 uppercase tracking-widest">
            A campanha será ativada nos canais autorizados acima.
          </p>

          {/* Quick Launch option */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => setQuickLaunchConfirm(true)}
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/20 hover:text-white/45 transition-colors flex items-center gap-1.5"
            >
              <Zap className="h-3 w-3" />
              Lançamento Direto — Modo Rápido
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE: CONNECTING ── */}
      {stage === "connecting" && (
        <div className="w-full max-w-lg px-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/20">
              Verificação de Canais Autorizados
            </div>
            <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-white">
              Sincronizando Canais
            </h2>
            <p className="font-mono text-[11px] text-white/25 leading-relaxed">
              Confirmando quais canais estão prontos para operação.
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-px bg-white/8 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-white/35 transition-all duration-500"
              style={{ width: `${(connectedCount / CHANNELS.length) * 100}%` }}
            />
          </div>

          {/* Channels list */}
          <div className="space-y-1.5">
            {CHANNELS.map((ch, i) => {
              const Icon = ch.icon;
              const status = channelStatuses[ch.id] ?? "idle";
              const isActive = i === currentChannelIdx;

              return (
                <div
                  key={ch.id}
                  className={`flex items-start gap-3 px-4 py-3 border transition-all duration-300 ${
                    status === "connected" ? "border-green-500/25 bg-green-500/5" :
                    status === "missing"   ? "border-white/8 bg-white/[0.015]" :
                    status === "skipped"   ? "border-white/4 opacity-35" :
                    isActive               ? "border-white/18 bg-white/[0.03]" :
                                             "border-white/4 opacity-25"
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: status === "idle" || status === "skipped" ? "rgba(255,255,255,0.04)" : `${ch.color}20`,
                      border: `1px solid ${ch.color}35`,
                    }}
                  >
                    <Icon
                      className="h-3.5 w-3.5"
                      style={{ color: status === "idle" || status === "skipped" ? "rgba(255,255,255,0.18)" : ch.color }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-white/75 uppercase tracking-widest">{ch.name}</span>
                      <div className="shrink-0">
                        {status === "checking"  && <Loader2 className="h-3.5 w-3.5 text-white/35 animate-spin" />}
                        {status === "connected" && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
                        {status === "skipped"   && <span className="font-mono text-[10px] uppercase tracking-widest text-white/18">Omitido</span>}
                      </div>
                    </div>

                    {status === "connected" && (
                      <p className="font-mono text-[10px] text-green-400/55 mt-0.5 leading-relaxed">{ch.role}</p>
                    )}

                    {status === "missing" && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <AlertTriangle className="h-3 w-3 text-yellow-400/50 shrink-0" />
                        <span className="font-mono text-[10px] text-white/25 flex-1">Canal não conectado — será omitido desta execução.</span>
                        <button
                          onClick={() => skipChannel(ch.id)}
                          className="font-mono text-[10px] uppercase tracking-widest text-white/25 hover:text-white/55 border border-white/8 hover:border-white/20 px-2 py-0.5 transition-all"
                        >
                          Ok
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
            <div className="border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="font-mono text-xs text-white/40 leading-relaxed">
                Alguns canais não estão conectados. A campanha será ativada nos canais disponíveis. Você pode conectar os demais a qualquer momento pelo painel.
              </p>
              <Button
                className="w-full font-mono uppercase tracking-widest rounded-none h-10 gap-2 text-xs"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)", color: "white" }}
                onClick={() => setStage("countdown")}
              >
                <Rocket className="h-4 w-4" />Ativar nos Canais Disponíveis
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── STAGE: COUNTDOWN ── */}
      {stage === "countdown" && (
        <div className="flex flex-col items-center gap-8 text-center px-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-white/20">
            Preparando Execução Operacional
          </div>

          {/* Countdown number */}
          <div className="relative w-44 h-44 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-white/8 animate-ping opacity-15" style={{ animationDuration: "1s" }} />
            <div className="absolute inset-2 rounded-full border border-white/4" />
            <div
              className="font-mono font-black text-white leading-none transition-all duration-300"
              style={{
                fontSize: countdown > 0 ? "6.5rem" : "3.5rem",
                textShadow: "0 0 30px rgba(255,255,255,0.25)",
                letterSpacing: "-0.05em",
              }}
            >
              {countdown > 0 ? countdown : "GO"}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-mono text-xs text-white/35 uppercase tracking-widest transition-all duration-500">
              {COUNTDOWN_LABELS[countdown] ?? ""}
            </p>
            <div className="flex gap-1.5 justify-center">
              {[5, 4, 3, 2, 1].map(n => (
                <div key={n} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${countdown < n ? "bg-white/70" : "bg-white/12"}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: LAUNCHED ── */}
      {stage === "launched" && (
        <div className="flex flex-col items-center gap-8 text-center px-6">
          <div className="relative">
            <div className="absolute -inset-8 rounded-full animate-ping opacity-8 bg-white" style={{ animationDuration: "1.5s" }} />
            <div className="absolute -inset-4 rounded-full animate-ping opacity-12 bg-white" style={{ animationDuration: "1s" }} />
            <CheckCircle2 className="h-18 w-18 text-white" style={{ filter: "drop-shadow(0 0 20px rgba(255,255,255,0.5))", width: "4.5rem", height: "4.5rem" }} />
          </div>

          <div className="space-y-3">
            <div className="font-mono font-black text-3xl md:text-5xl uppercase tracking-tighter text-white" style={{ textShadow: "0 0 30px rgba(255,255,255,0.25)" }}>
              Campanha Ativa
            </div>
            <p className="font-mono text-xs text-white/35 uppercase tracking-[0.2em]">
              Operando nos canais aprovados · Sob sua supervisão
            </p>
          </div>

          {/* Active channels */}
          <div className="flex flex-col gap-1.5 items-center">
            {CHANNELS.filter(c => channelStatuses[c.id] === "connected").map(ch => {
              const Icon = ch.icon;
              return (
                <div key={ch.id} className="flex items-center gap-2 font-mono text-[11px] text-white/25 uppercase tracking-widest">
                  <Wifi className="h-3 w-3" style={{ color: ch.color, opacity: 0.6 }} />
                  <Icon className="h-3 w-3" style={{ color: ch.color, opacity: 0.6 }} />
                  <span>{ch.name} — operacional</span>
                </div>
              );
            })}
          </div>

          <p className="font-mono text-[10px] text-white/18 uppercase tracking-widest animate-pulse">
            Abrindo painel de controle...
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
    <div className="flex flex-col items-center gap-3 py-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="group relative flex items-center gap-3 px-8 py-3.5 font-mono font-black text-sm uppercase tracking-[0.18em] text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
          border: "1px solid rgba(255,255,255,0.22)",
          boxShadow: "0 0 20px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Rocket className="h-4 w-4 group-hover:translate-y-[-2px] transition-transform" style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.35))" }} />
        }
        Ativar Campanha
      </button>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/25">
        Ativos aprovados · Aguardando sua autorização
      </p>
    </div>
  );
}
