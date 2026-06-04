import React, { useState, useEffect } from "react";
import { X, Users, ArrowRight, CheckCircle2, Loader2, Phone, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const WA_LINK_DEFAULT = "https://wa.me/message/NBJH4EXPAV2EN1";
const API_BASE = "/api";

function getSeqId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("seq");
  } catch {
    return null;
  }
}

function getUtms(): Record<string, string> {
  try {
    const params = new URLSearchParams(window.location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"];
    const result: Record<string, string> = {};
    for (const k of keys) {
      const v = params.get(k);
      if (v) result[k] = v;
    }
    return result;
  } catch {
    return {};
  }
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10) return `+55${digits}`;
  return `+55${digits}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  redirectUrl?: string;
  title?: string;
  subtitle?: string;
}

type Step = "form" | "loading" | "success" | "error";

export default function LeadCaptureModal({ open, onClose, onSuccess, redirectUrl, title, subtitle }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setErrorMsg("");
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const openWA = () => {
    window.open(redirectUrl ?? WA_LINK_DEFAULT, "_blank", "noopener,noreferrer");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Informe seu nome completo para continuar.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Informe um email válido.");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("Informe seu WhatsApp para receber o guia.");
      return;
    }
    setStep("loading");
    setErrorMsg("");

    const seqId = getSeqId();
    const utms  = getUtms();

    const payload: Record<string, string> = {
      phone: formatPhone(phone),
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      utmSource:   utms.utm_source   ?? "landing",
      utmMedium:   utms.utm_medium   ?? "organico",
      utmCampaign: utms.utm_campaign ?? "guia_gratuito",
      ...(utms.utm_content ? { utmContent: utms.utm_content } : {}),
      ...(utms.utm_term    ? { utmTerm:    utms.utm_term    } : {}),
      ...(utms.ref         ? { referralCode: utms.ref       } : {}),
    };

    try {
      if (seqId) {
        const res = await fetch(`${API_BASE}/lead-capture/${seqId}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        if (!res.ok && res.status !== 409) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Erro ao capturar lead");
        }
      }
      setStep("success");
      onSuccess?.();
      setTimeout(openWA, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      setErrorMsg(message);
      setStep("error");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-card border border-border/40 rounded-t-2xl sm:rounded-none shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/60 mb-2">
              — Guia Gratuito · NexOS —
            </div>
            <h2 className="font-mono font-black text-xl uppercase tracking-tight text-foreground leading-snug whitespace-pre-line">
              {title ?? "Receba o guia\nno seu WhatsApp"}
            </h2>
            {subtitle && (
              <p className="font-mono text-xs text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors mt-0.5 ml-4 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* FORM / ERROR */}
          {(step === "form" || step === "error") && (
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Nome completo */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Nome completo <span className="text-primary/60">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="w-full bg-background border border-border/40 rounded-none pl-9 pr-4 h-11 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Email <span className="text-primary/60">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full bg-background border border-border/40 rounded-none pl-9 pr-4 h-11 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  WhatsApp <span className="text-primary/60">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    required
                    autoFocus
                    className="w-full bg-background border border-border/40 rounded-none pl-9 pr-4 h-11 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="font-mono text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <Button type="submit" className="btn-weapon-primary w-full rounded-none font-mono uppercase tracking-widest font-black h-13 gap-2 text-sm">
                <Users className="h-4 w-4" /> Enviar Guia no WhatsApp
              </Button>

              <p className="font-mono text-[10px] text-center text-muted-foreground/30 leading-relaxed">
                Sem spam. Somente conteúdo de lançamento e o link do guia.
                Você pode sair quando quiser.
              </p>
            </form>
          )}

          {/* LOADING */}
          {step === "loading" && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <div>
                <div className="font-mono font-black text-base uppercase tracking-tight">Registrando...</div>
                <div className="font-mono text-xs text-muted-foreground/50 mt-1">Preparando seu guia</div>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <div className="py-6 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="font-mono font-black text-lg uppercase tracking-tight mb-1">Tudo certo!</div>
                <div className="font-mono text-sm text-muted-foreground/70 leading-relaxed">
                  Abrindo WhatsApp agora...<br />
                  Você vai receber o link do guia direto no chat.
                </div>
              </div>
              <Button onClick={openWA} className="btn-weapon-primary w-full rounded-none font-mono uppercase tracking-widest font-black h-12 gap-2 text-xs">
                Abrir WhatsApp <ArrowRight className="h-4 w-4" />
              </Button>
              <button onClick={onClose} className="font-mono text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
