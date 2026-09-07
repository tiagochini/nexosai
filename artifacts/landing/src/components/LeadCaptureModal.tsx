import React, { useState, useEffect } from "react";
import { X, Users, ArrowRight, CheckCircle2, Loader2, Phone, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

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
      setErrorMsg("Informe seu WhatsApp para confirmar.");
      return;
    }
    setStep("loading");
    setErrorMsg("");

    const seqId = getSeqId();
    const utms  = getUtms();

    const payload: Record<string, string> = {
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: formatPhone(phone),
      segment: "individual",
      source: "landing-plf",
      ...(seqId ? { phone: formatPhone(phone) } : {}), // Fallback map for seq endpoint if it strictly expects phone
      utmSource:   utms.utm_source   ?? "landing",
      utmMedium:   utms.utm_medium   ?? "organico",
      utmCampaign: utms.utm_campaign ?? "guia_gratuito",
      ...(utms.utm_content ? { utmContent: utms.utm_content } : {}),
      ...(utms.utm_term    ? { utmTerm:    utms.utm_term    } : {}),
      ...(utms.ref         ? { referralCode: utms.ref       } : {}),
    };

    try {
      const endpoint = seqId ? `${API_BASE}/lead-capture/${seqId}` : `${API_BASE}/waitlist`;

      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok && res.status !== 409) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Não foi possível confirmar seu registro. Verifique os dados e tente novamente.");
      }

      setStep("success");
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ocorreu um erro inesperado. Tente novamente.";
      setErrorMsg(message);
      setStep("error");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-lg"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full sm:max-w-md bg-card/90 backdrop-blur-2xl border border-border/80 rounded-t-3xl sm:rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="flex items-start justify-between px-8 pt-8 pb-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary mb-3 font-semibold">
                  Acesso Antecipado NexOS
                </div>
                <h2 className="font-sans font-black text-2xl tracking-tight text-foreground leading-snug whitespace-pre-line">
                  {title ?? "Entre na Lista de Abertura"}
                </h2>
                <p className="font-sans text-sm text-muted-foreground mt-2 font-light">
                  {subtitle ?? "O sistema está em fase de homologação final. Cadastre-se para ser notificado assim que o checkout oficial for liberado. Sem custos."}
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/5">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-8 pb-8 pt-4">
              {(step === "form" || step === "error") && (
                <motion.form
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold ml-1">
                      Nome completo
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Como você se chama?"
                        required
                        className="w-full bg-background/50 border border-border/80 rounded-xl pl-11 pr-4 h-12 font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold ml-1">
                      Email principal
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        className="w-full bg-background/50 border border-border/80 rounded-xl pl-11 pr-4 h-12 font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold ml-1">
                      WhatsApp
                    </label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        required
                        className="w-full bg-background/50 border border-border/80 rounded-xl pl-11 pr-4 h-12 font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-sans text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                      {errorMsg}
                    </motion.p>
                  )}

                  <Button type="submit" className="w-full h-14 mt-4 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] rounded-xl font-sans font-bold text-base transition-all tracking-wide flex items-center justify-center gap-2">
                    <Users className="h-5 w-5" /> Entrar na Lista de Abertura
                  </Button>

                  <p className="font-sans text-xs text-center text-muted-foreground/60 leading-relaxed pt-2 font-light">
                    Sua privacidade é preservada. Não enviamos spam.
                  </p>
                </motion.form>
              )}

              {step === "loading" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center gap-6 text-center">
                  <Loader2 className="h-12 w-12 text-primary animate-spin drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]" />
                  <div>
                    <div className="font-sans font-bold text-xl tracking-tight">Confirmando lugar...</div>
                    <div className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">Salvando seu registro</div>
                  </div>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-success/10 border border-success/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,163,0.2)]">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                  <div>
                    <div className="font-sans font-black text-2xl tracking-tight mb-2">Lugar Reservado!</div>
                    <div className="font-sans text-sm text-muted-foreground leading-relaxed font-light">
                      O seu registro foi confirmado na lista de abertura. Nenhum valor foi cobrado.<br /><br />
                      Você receberá um e-mail de aviso com antecedência assim que os acessos estiverem liberados e o lançamento iniciar.
                    </div>
                  </div>
                  <Button onClick={openWA} className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-xl font-sans font-bold text-base transition-all flex items-center justify-center gap-2 mt-4">
                    Falar com equipe no WhatsApp <ArrowRight className="h-5 w-5" />
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
// End of lead capture modal.
