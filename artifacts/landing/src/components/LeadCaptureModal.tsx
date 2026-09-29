import React, { useState, useEffect } from "react";
import { X, Users, ArrowRight, CheckCircle2, Loader2, Phone, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n, type Lang } from "@/lib/i18n";

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
  closed?: boolean;
  onCapacityReached?: () => void;
  onSuccess?: () => void;
  redirectUrl?: string;
  title?: string;
  subtitle?: string;
}

type Step = "form" | "loading" | "success" | "error";
type ErrorKey =
  | "nameRequired"
  | "emailInvalid"
  | "phoneRequired"
  | "capacityReached"
  | "identityConflict"
  | "invalidRequest"
  | "registrationUnavailable"
  | "registrationClosed"
  | "tooManyRequests"
  | "network"
  | "generic";

type ModalCopy = {
  dialogLabel: string;
  close: string;
  earlyAccess: string;
  title: string;
  subtitle: string;
  closedTitle: string;
  closedDescription: string;
  contactTeam: string;
  fullName: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  whatsapp: string;
  whatsappPlaceholder: string;
  submit: string;
  privacy: string;
  confirming: string;
  saving: string;
  successTitle: string;
  successDescription: string;
  errors: Record<ErrorKey, string>;
};

const MODAL_COPY: Record<Lang, ModalCopy> = {
  "pt-BR": {
    dialogLabel: "Cadastro para acesso antecipado",
    close: "Fechar",
    earlyAccess: "Acesso antecipado",
    title: "Entre na lista de abertura",
    subtitle: "Reserve sua vaga para a abertura inicial. Os detalhes do lançamento e do contato chegarão por e-mail ou WhatsApp.",
    closedTitle: "Turma inicial encerrada",
    closedDescription: "As 100 vagas iniciais de pré-lançamento foram encerradas. Não há data prevista para reabertura e as condições futuras podem ser diferentes.",
    contactTeam: "Falar com a equipe no WhatsApp",
    fullName: "Nome completo",
    namePlaceholder: "Como você se chama?",
    email: "E-mail principal",
    emailPlaceholder: "seu@email.com",
    whatsapp: "WhatsApp",
    whatsappPlaceholder: "+55 (11) 99999-9999",
    submit: "Reservar uma das 100 vagas iniciais",
    privacy: "Sua privacidade é preservada. Não enviamos spam.",
    confirming: "Confirmando sua vaga...",
    saving: "Salvando seu cadastro",
    successTitle: "Vaga reservada!",
    successDescription: "Você reservou uma das 100 vagas iniciais de pré-lançamento. Nenhum valor foi cobrado. Os detalhes do lançamento e do contato chegarão por e-mail ou WhatsApp. Depois que as 100 vagas iniciais forem preenchidas, não há data para reabertura e as condições futuras podem ser diferentes.",
    errors: {
      nameRequired: "Informe seu nome completo para continuar.",
      emailInvalid: "Informe um e-mail válido.",
      phoneRequired: "Informe seu WhatsApp para confirmar.",
      capacityReached: "As vagas iniciais foram preenchidas. A data de reabertura é desconhecida; fale com a equipe pelo WhatsApp.",
      identityConflict: "Este e-mail e este telefone parecem estar vinculados a cadastros diferentes. Confira os dados ou fale com a equipe.",
      invalidRequest: "Confira os dados informados e tente novamente.",
      registrationUnavailable: "Este link de cadastro não está disponível. Confira o endereço ou fale com a equipe.",
      registrationClosed: "Este cadastro não está aceitando novas inscrições no momento. Fale com a equipe pelo WhatsApp.",
      tooManyRequests: "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.",
      network: "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      generic: "Não foi possível confirmar seu cadastro. Tente novamente.",
    },
  },
  "en-US": {
    dialogLabel: "Early access registration",
    close: "Close",
    earlyAccess: "Early access",
    title: "Join the launch waitlist",
    subtitle: "Reserve your spot for the first launch. Launch and contact details will arrive by email or WhatsApp.",
    closedTitle: "The initial group is full",
    closedDescription: "All 100 early-access spots have been filled. There is no reopening date yet, and future terms may differ.",
    contactTeam: "Contact our team on WhatsApp",
    fullName: "Full name",
    namePlaceholder: "What is your name?",
    email: "Primary email",
    emailPlaceholder: "you@example.com",
    whatsapp: "WhatsApp",
    whatsappPlaceholder: "+55 (11) 99999-9999",
    submit: "Reserve one of the first 100 spots",
    privacy: "Your privacy is protected. We never send spam.",
    confirming: "Confirming your spot...",
    saving: "Saving your registration",
    successTitle: "Spot reserved!",
    successDescription: "You have reserved one of the first 100 early-access spots. You have not been charged. Launch and contact details will arrive by email or WhatsApp. Once all 100 initial spots are filled, there is no reopening date, and future terms may differ.",
    errors: {
      nameRequired: "Enter your full name to continue.",
      emailInvalid: "Enter a valid email address.",
      phoneRequired: "Enter your WhatsApp number to confirm.",
      capacityReached: "The initial spots have been filled. There is no reopening date yet; contact our team on WhatsApp.",
      identityConflict: "This email and phone number appear to belong to different registrations. Check your details or contact our team.",
      invalidRequest: "Check the information you entered and try again.",
      registrationUnavailable: "This registration link is unavailable. Check the address or contact our team.",
      registrationClosed: "This registration is not accepting new sign-ups right now. Contact our team on WhatsApp.",
      tooManyRequests: "Too many attempts in a short time. Please wait a moment and try again.",
      network: "We couldn't connect. Check your connection and try again.",
      generic: "We couldn't confirm your registration. Please try again.",
    },
  },
  "es-LA": {
    dialogLabel: "Registro para acceso anticipado",
    close: "Cerrar",
    earlyAccess: "Acceso anticipado",
    title: "Únete a la lista de lanzamiento",
    subtitle: "Reserva tu lugar para el lanzamiento inicial. Recibirás los detalles del lanzamiento y del contacto por correo electrónico o WhatsApp.",
    closedTitle: "El grupo inicial está completo",
    closedDescription: "Ya se ocuparon los 100 lugares iniciales de acceso anticipado. Aún no hay una fecha de reapertura y las condiciones futuras pueden ser diferentes.",
    contactTeam: "Contactar al equipo por WhatsApp",
    fullName: "Nombre completo",
    namePlaceholder: "¿Cómo te llamas?",
    email: "Correo electrónico principal",
    emailPlaceholder: "tu@correo.com",
    whatsapp: "WhatsApp",
    whatsappPlaceholder: "+55 (11) 99999-9999",
    submit: "Reserva uno de los primeros 100 lugares",
    privacy: "Protegemos tu privacidad. No enviamos spam.",
    confirming: "Confirmando tu lugar...",
    saving: "Guardando tu registro",
    successTitle: "¡Lugar reservado!",
    successDescription: "Reservaste uno de los 100 lugares iniciales de acceso anticipado. No se te cobró ningún importe. Recibirás los detalles del lanzamiento y del contacto por correo electrónico o WhatsApp. Cuando se ocupen los 100 lugares iniciales, no habrá una fecha de reapertura y las condiciones futuras pueden ser diferentes.",
    errors: {
      nameRequired: "Ingresa tu nombre completo para continuar.",
      emailInvalid: "Ingresa un correo electrónico válido.",
      phoneRequired: "Ingresa tu número de WhatsApp para confirmar.",
      capacityReached: "Ya se ocuparon los lugares iniciales. Aún no hay una fecha de reapertura; contacta al equipo por WhatsApp.",
      identityConflict: "Este correo y este teléfono parecen pertenecer a registros distintos. Revisa tus datos o contacta al equipo.",
      invalidRequest: "Revisa los datos ingresados e inténtalo de nuevo.",
      registrationUnavailable: "Este enlace de registro no está disponible. Revisa la dirección o contacta al equipo.",
      registrationClosed: "Este registro no acepta nuevas inscripciones por el momento. Contacta al equipo por WhatsApp.",
      tooManyRequests: "Hiciste demasiados intentos en poco tiempo. Espera un momento e inténtalo de nuevo.",
      network: "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.",
      generic: "No pudimos confirmar tu registro. Inténtalo de nuevo.",
    },
  },
};

function getApiErrorKey(status: number, code: unknown): ErrorKey {
  if (code === "LAUNCH_CAPACITY_REACHED") return "capacityReached";
  if (code === "IDENTITY_CONFLICT") return "identityConflict";
  if (status === 400) return "invalidRequest";
  if (status === 404) return "registrationUnavailable";
  if (status === 409) return "registrationClosed";
  if (status === 429) return "tooManyRequests";
  return "generic";
}

export default function LeadCaptureModal({ open, onClose, closed = false, onCapacityReached, onSuccess, redirectUrl, title, subtitle }: Props) {
  const { lang } = useI18n();
  const copy = MODAL_COPY[lang];
  const [step, setStep] = useState<Step>("form");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  useEffect(() => {
    if (open) {
      setStep(closed && !getSeqId() ? "error" : "form");
      setErrorKey(null);
    }
  }, [open, closed]);

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
      setErrorKey("nameRequired");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorKey("emailInvalid");
      return;
    }
    if (!phone.trim()) {
      setErrorKey("phoneRequired");
      return;
    }
    setStep("loading");
    setErrorKey(null);

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

      const data = await res.json().catch(() => null) as { code?: unknown } | null;
      if (res.status === 409 && data?.code === "LAUNCH_CAPACITY_REACHED") {
        onCapacityReached?.();
        setErrorKey("capacityReached");
        setStep("error");
        return;
      }
      if (!res.ok) {
        setErrorKey(getApiErrorKey(res.status, data?.code));
        setStep("error");
        return;
      }

      setStep("success");
      onSuccess?.();
    } catch {
      setErrorKey("network");
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
          aria-labelledby="lead-capture-title"
          aria-describedby="lead-capture-description"
          aria-label={copy.dialogLabel}
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
            className="relative z-10 w-full sm:max-w-md bg-card border-2 border-border shadow-2xl overflow-hidden"
          >

            <div className="flex items-start justify-between px-8 pt-8 pb-2">
              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-primary mb-3 font-semibold">
                  {copy.earlyAccess}
                </div>
                <h2 id="lead-capture-title" className="font-display font-bold text-2xl tracking-tight text-foreground leading-snug whitespace-pre-line">
                  {title ?? copy.title}
                </h2>
                <p id="lead-capture-description" className="font-sans text-sm text-muted-foreground mt-2 font-light">
                  {subtitle ?? copy.subtitle}
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label={copy.close} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/5">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-8 pb-8 pt-4">
              {closed && !getSeqId() ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center space-y-5">
                  <div className="font-sans font-black text-2xl">{copy.closedTitle}</div>
                  <p className="font-sans text-sm text-muted-foreground leading-relaxed">{copy.closedDescription}</p>
                  <Button onClick={openWA} className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 font-display font-bold">{copy.contactTeam} <ArrowRight className="ml-2 h-5 w-5" /></Button>
                </motion.div>
              ) : (step === "form" || step === "error") && (
                <motion.form
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit}
                  noValidate
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label htmlFor="lead-capture-name" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {copy.fullName}
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        id="lead-capture-name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={copy.namePlaceholder}
                        required
                        className="w-full bg-background border border-border pl-11 pr-4 h-12 font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors rounded-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="lead-capture-email" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {copy.email}
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        id="lead-capture-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={copy.emailPlaceholder}
                        required
                        className="w-full bg-background border border-border pl-11 pr-4 h-12 font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors rounded-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="lead-capture-whatsapp" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {copy.whatsapp}
                    </label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        id="lead-capture-whatsapp"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder={copy.whatsappPlaceholder}
                        required
                        className="w-full bg-background border border-border pl-11 pr-4 h-12 font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors rounded-none"
                      />
                    </div>
                  </div>

                  {errorKey && (
                    <motion.p role="alert" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-sans text-sm text-destructive bg-destructive/10 border border-destructive px-4 py-3">
                      {copy.errors[errorKey]}
                    </motion.p>
                  )}

                  <Button type="submit" className="w-full h-14 mt-4 bg-primary text-primary-foreground hover:bg-primary/90 font-display font-bold text-base transition-colors tracking-wide flex items-center justify-center gap-2 rounded-none">
                    <Users className="h-5 w-5" /> {copy.submit}
                  </Button>

                  <p className="font-sans text-xs text-center text-muted-foreground/60 leading-relaxed pt-2 font-light">
                    {copy.privacy}
                  </p>
                </motion.form>
              )}

              {step === "loading" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center gap-6 text-center">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <div>
                    <div className="font-display font-bold text-xl tracking-tight">{copy.confirming}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">{copy.saving}</div>
                  </div>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-6 text-center">
                  <div className="w-20 h-20 rounded-none bg-primary/10 border-2 border-primary flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                  </div>
                  <div>
                    <div className="font-display font-black text-2xl tracking-tight mb-2">{copy.successTitle}</div>
                    <div className="font-sans text-sm text-muted-foreground leading-relaxed font-light">
                      {copy.successDescription}
                    </div>
                  </div>
                  <Button onClick={openWA} className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-none font-display font-bold text-base transition-colors flex items-center justify-center gap-2 mt-4">
                    {copy.contactTeam} <ArrowRight className="h-5 w-5" />
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
