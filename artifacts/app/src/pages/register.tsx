import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { useAppI18n, useUiLocale, useUiText } from "@/lib/i18n";
import { GuestLanguageSwitcher } from "@/components/guest-language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Eye, EyeOff, CheckCircle2, XCircle, Gift, Lock, Users,
  ShoppingCart, RefreshCw, ArrowLeft, Copy, ExternalLink,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Mode = "gate" | "code-form" | "request" | "purchase";

function FieldStatus({ ok, msg }: { ok: boolean | null; msg: string }) {
  if (ok === null) return null;
  return (
    <div className={`flex items-center gap-1.5 mt-1 ${ok ? "text-success" : "text-destructive"}`}>
      {ok ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
      <span className="font-mono text-xs uppercase tracking-widest">{msg}</span>
    </div>
  );
}

const CARD_CLASS = "border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] group";
const CORNER_TL = "absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow";
const CORNER_TR = "absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow";
const CORNER_BL = "absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow";
const CORNER_BR = "absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow";
const inputClass = "font-mono bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.3)] rounded-none transition-all";

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const t = useUiText();
  const h = size === "sm" ? "h-20 w-20" : "h-32 w-32";
  return (
    <div className="flex flex-col items-center mb-6 relative">
      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full w-32 h-32 m-auto" />
      <img src={nexosLogo} alt="NexOS" className={`${h} object-contain mb-2 relative z-10`}
        style={{ imageRendering: "crisp-edges", filter: "drop-shadow(0 0 20px hsl(var(--primary)/0.6))" }} />
      <p className="text-primary text-sm uppercase tracking-[0.3em] font-mono mt-2 font-bold drop-shadow-[0_0_5px_hsl(var(--primary)/0.8)]">
        {t("Acesso Exclusivo", "Exclusive Access", "Acceso exclusivo")}
      </p>
    </div>
  );
}

export default function Register() {
  const [mode, setMode] = useState<Mode>("gate");

  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [confirmEmail, setConfirmEmail]   = useState("");
  const [phone, setPhone]                 = useState("");
  const [confirmPhone, setConfirmPhone]   = useState("");
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [plan, setPlan]                   = useState("solo");
  const [referralCode, setReferralCode]   = useState("");
  const [inviteCode, setInviteCode]       = useState("");

  const [reqName, setReqName]   = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqWa, setReqWa]       = useState("");
  const [reqSent, setReqSent]   = useState(false);

  const [, setLocation] = useLocation();
  const { setToken }    = useAuth();
  const tr = useAppI18n();
  const t = tr.register;
  const uiText = useUiText();
  const { locale } = useUiLocale();

  const { data: platformStatus } = useQuery({
    queryKey: ["/api/auth/platform-status"],
    queryFn: () => customFetch<{ platformOpen: boolean; cartOpen: boolean }>("/api/auth/platform-status"),
    staleTime: 60_000,
  });

  const cartOpen = platformStatus?.cartOpen ?? false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.toUpperCase().trim());
    const inv = params.get("invite") || params.get("code");
    if (inv) {
      setInviteCode(inv.toUpperCase().trim());
      setMode("code-form");
    }
  }, []);

  const emailMatch  = confirmEmail.length > 0 ? email === confirmEmail : null;
  const phoneMatch  = confirmPhone.length > 0 ? phone === confirmPhone : null;
  const passStrong  = password.length >= 8;
  const passMatch   = confirmPassword.length > 0 ? password === confirmPassword : null;
  const canSubmit   = name.trim().length >= 2 && email.trim().length > 0 &&
    emailMatch === true && passStrong && passMatch === true &&
    (phone.length === 0 || phoneMatch === true);

  const requestMutation = useMutation({
    mutationFn: () =>
      customFetch<{ joined: boolean; message: string }>("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: reqName, whatsapp: reqWa, email: reqEmail, source: "access_request" }),
      }),
    onSuccess: (data) => {
      setReqSent(true);
          toast.success(data.message ?? uiText("Solicitação enviada!", "Request sent!", "¡Solicitud enviada!"));
    },
    onError: (err: Error) => toast.error(err.message ?? uiText("Erro ao enviar solicitação.", "Error sending request.", "Error al enviar la solicitud.")),
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        const raw = data as typeof data & { refreshToken?: string };
        setToken(data.accessToken, raw.refreshToken);
        toast.success(t.success);
        setLocation("/welcome");
      },
      onError: (err: Error & { body?: { code?: string } }) => {
        const code = err?.body?.code;
        if (code === "PLATFORM_CLOSED") {
          setMode("gate");
          toast.error(uiText("Código de convite inválido ou plataforma fechada.", "Invalid invite code or the platform is closed.", "Código de invitación no válido o plataforma cerrada."));
          return;
        }
        toast.error(t.error);
      },
    },
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    registerMutation.mutate({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        planSlug: plan,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(referralCode ? { referralCode } : {}),
        ...(inviteCode ? { inviteCode } : {}),
        locale,
      },
    });
  };

  const wrapperClass = "min-h-screen auth-bg-gradient flex flex-col items-center justify-center p-4 py-8";
  const innerClass = "w-full max-w-md relative z-10 animate-in fade-in blur-in duration-700 space-y-4";

  // ── Gate (always shown first) ─────────────────────────────────────────────
  if (mode === "gate") {
    return (
      <div className={wrapperClass}>
        <div className={innerClass}>
          <Logo />
          <GuestLanguageSwitcher />
          <div className={CARD_CLASS}>
            <div className={CORNER_TL} /><div className={CORNER_TR} />
            <div className={CORNER_BL} /><div className={CORNER_BR} />
            <div className="relative z-10 space-y-4">
              <div className="text-center space-y-1 mb-6">
                <h1 className="font-mono text-lg font-bold uppercase tracking-tighter">{uiText("Como deseja acessar?", "How would you like to access?", "¿Cómo quieres acceder?")}</h1>
                <p className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
                  {uiText("Escolha uma das opções abaixo", "Choose one of the options below", "Elige una de las opciones")}
                </p>
              </div>

              <button
                onClick={() => setMode("code-form")}
                className="w-full flex items-center gap-4 border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 p-4 transition-all group/btn text-left"
              >
                <div className="h-10 w-10 border border-primary/40 flex items-center justify-center shrink-0 group-hover/btn:border-primary group-hover/btn:shadow-[0_0_10px_hsl(var(--primary)/0.4)] transition-all">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <div>
                   <div className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">{uiText("Tenho código de convite", "I have an invite code", "Tengo un código de invitación")}</div>
                   <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{uiText("Inserir código e criar conta", "Enter your code and create an account", "Ingresa el código y crea una cuenta")}</div>
                </div>
              </button>

              {cartOpen && (
                <button
                  onClick={() => setMode("purchase")}
                  className="w-full flex items-center gap-4 border border-success/30 bg-success/5 hover:bg-success/10 hover:border-success/60 p-4 transition-all group/btn text-left"
                >
                  <div className="h-10 w-10 border border-success/40 flex items-center justify-center shrink-0 group-hover/btn:border-success group-hover/btn:shadow-[0_0_10px_hsl(var(--success)/0.4)] transition-all">
                    <ShoppingCart className="h-4 w-4 text-success" />
                  </div>
                  <div>
                     <div className="font-mono text-sm font-bold uppercase tracking-widest text-success">{uiText("Adquirir acesso", "Purchase access", "Comprar acceso")}</div>
                     <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{uiText("Comprar e receber acesso imediato", "Buy now and get immediate access", "Compra y obtén acceso inmediato")}</div>
                  </div>
                </button>
              )}

              <button
                onClick={() => setMode("request")}
                className="w-full flex items-center gap-4 border border-border/40 bg-card/20 hover:bg-card/40 hover:border-border/70 p-4 transition-all group/btn text-left"
              >
                <div className="h-10 w-10 border border-border/40 flex items-center justify-center shrink-0 group-hover/btn:border-muted-foreground transition-all">
                  <Users className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <div>
                   <div className="font-mono text-sm font-bold uppercase tracking-widest text-muted-foreground">{uiText("Solicitar liberação", "Request access", "Solicitar acceso")}</div>
                   <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">{uiText("Aguardar aprovação do administrador", "Wait for administrator approval", "Espera la aprobación del administrador")}</div>
                </div>
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link href="/login">
              <span className="font-mono text-xs text-primary/60 hover:text-primary uppercase tracking-widest transition-colors">
                  {uiText("← Já tenho conta", "← I already have an account", "← Ya tengo una cuenta")}
              </span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Purchase options ──────────────────────────────────────────────────────
  if (mode === "purchase") {
    return (
      <div className={wrapperClass}>
        <div className={innerClass}>
          <Logo size="sm" />
          <GuestLanguageSwitcher />
          <div className={CARD_CLASS}>
            <div className={CORNER_TL} /><div className={CORNER_TR} />
            <div className={CORNER_BL} /><div className={CORNER_BR} />
            <div className="relative z-10 space-y-4">
              <div className="text-center mb-4">
                <h1 className="font-mono text-base font-bold uppercase tracking-tighter">{uiText("Produtos Disponíveis", "Available Products", "Productos disponibles")}</h1>
              </div>

              <a
                href="https://pay.hotmart.com/nexos-academy"
                target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-between border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 p-4 transition-all group/btn"
              >
                <div>
                  <div className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">NexOS Academy</div>
                  <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{uiText("Metodologia completa · Acesso vitalício", "Complete methodology · Lifetime access", "Metodología completa · Acceso de por vida")}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="font-mono text-lg font-black text-primary">R$2.990</div>
                  <div className="flex items-center gap-1 justify-end"><ExternalLink className="h-3 w-3 text-muted-foreground/40" /></div>
                </div>
              </a>

              <a
                href="https://pay.hotmart.com/nexos-integracoes"
                target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-between border border-border/40 bg-card/20 hover:bg-card/40 hover:border-border/70 p-4 transition-all group/btn"
              >
                <div>
                  <div className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">{uiText("Curso de Integrações", "Integrations Course", "Curso de integraciones")}</div>
                  <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{uiText("Meta Ads, redes sociais e conexões", "Meta Ads, social networks, and connections", "Meta Ads, redes sociales y conexiones")}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="font-mono text-lg font-black text-foreground">R$1.000</div>
                  <div className="flex items-center gap-1 justify-end"><ExternalLink className="h-3 w-3 text-muted-foreground/40" /></div>
                </div>
              </a>

              <div className="border border-border/20 bg-card/10 p-4">
                <div className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest text-center">
                  {uiText("NexOS AI Plataforma — Disponível somente na abertura do carrinho para clientes credenciados", "NexOS AI Platform — Available only during the enrollment period for approved customers", "Plataforma NexOS AI — Disponible solo durante la apertura de inscripciones para clientes autorizados")}
                </div>
              </div>

              <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest text-center">
                {uiText("Após a compra você receberá seu código de acesso por e-mail", "After purchase, your access code will be sent by email", "Después de la compra, recibirás tu código de acceso por correo electrónico")}
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <button onClick={() => setMode("gate")} className="font-mono text-xs text-muted-foreground/40 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" /> {uiText("Voltar", "Back", "Volver")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Request access (waitlist) ─────────────────────────────────────────────
  if (mode === "request") {
    return (
      <div className={wrapperClass}>
        <div className={innerClass}>
          <Logo size="sm" />
          <GuestLanguageSwitcher />
          <div className={CARD_CLASS}>
            <div className={CORNER_TL} /><div className={CORNER_TR} />
            <div className={CORNER_BL} /><div className={CORNER_BR} />
            <div className="relative z-10 space-y-4">
              {reqSent ? (
                <div className="text-center py-6 space-y-3">
                  <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                  <h1 className="font-mono text-base font-bold uppercase tracking-tighter text-success">{uiText("Solicitação Enviada!", "Request Sent!", "¡Solicitud enviada!")}</h1>
                  <p className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
                    {uiText("Sua solicitação foi recebida. O administrador analisará seu pedido e você receberá um código de acesso pelo WhatsApp.", "Your request was received. An administrator will review it, and you will receive an access code on WhatsApp.", "Recibimos tu solicitud. Un administrador la revisará y recibirás un código de acceso por WhatsApp.")}
                  </p>
                  <Link href="/login">
                    <Button variant="outline" className="rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-outline mt-2">
                      {uiText("Já tenho código → Login", "I have a code → Sign in", "Ya tengo un código → Iniciar sesión")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4 space-y-1">
                    <h1 className="font-mono text-base font-bold uppercase tracking-tighter">{uiText("Solicitar Liberação", "Request Access", "Solicitar acceso")}</h1>
                    <p className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
                      {uiText("Preencha seus dados — o admin verificará e enviará seu código", "Enter your details — an administrator will review them and send you a code", "Completa tus datos — un administrador los revisará y te enviará un código")}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{uiText("Nome completo", "Full name", "Nombre completo")}</Label>
                      <Input value={reqName} onChange={e => setReqName(e.target.value)}
                        placeholder={uiText("Seu nome", "Your name", "Tu nombre")} className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{uiText("E-mail", "Email", "Correo electrónico")}</Label>
                      <Input type="email" value={reqEmail} onChange={e => setReqEmail(e.target.value)}
                        placeholder={uiText("seu@email.com", "you@email.com", "tu@correo.com")} className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">WhatsApp</Label>
                      <Input type="tel" value={reqWa} onChange={e => setReqWa(e.target.value)}
                        placeholder="11999999999" className={inputClass} />
                      <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                        {uiText("Você receberá seu código de acesso aqui", "You will receive your access code here", "Recibirás tu código de acceso aquí")}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => { if (reqName.trim() && reqWa.trim()) requestMutation.mutate(); }}
                    disabled={!reqName.trim() || !reqWa.trim() || requestMutation.isPending}
                    className="w-full rounded-none font-mono uppercase tracking-widest font-bold btn-weapon-primary h-11 mt-2"
                  >
                    {requestMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : uiText("Enviar Solicitação →", "Send Request →", "Enviar solicitud →")}
                  </Button>
                </>
              )}
            </div>
          </div>

          {!reqSent && (
            <div className="text-center pt-2">
              <button onClick={() => setMode("gate")} className="font-mono text-xs text-muted-foreground/40 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1 mx-auto">
                <ArrowLeft className="h-3 w-3" /> {uiText("Voltar", "Back", "Volver")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Registration form (code-form mode) ────────────────────────────────────
  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-md relative z-10 animate-in fade-in blur-in duration-1000">
        <Logo size="sm" />
        <GuestLanguageSwitcher />

        <div className={CARD_CLASS}>
          <div className={CORNER_TL} /><div className={CORNER_TR} />
          <div className={CORNER_BL} /><div className={CORNER_BR} />

          <form onSubmit={handleRegister} className="space-y-5 relative z-10">

            <div className="text-center mb-4">
              <h1 className="font-mono text-base font-bold uppercase tracking-tighter">{t.title}</h1>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.name_label} <span className="text-destructive">*</span>
              </Label>
              <Input id="name" required autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} placeholder={t.name_ph} className={inputClass} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.email_label} <span className="text-destructive">*</span>
              </Label>
              <Input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder={t.email_ph} className={inputClass} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmEmail" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.email_confirm_label} <span className="text-destructive">*</span>
              </Label>
              <Input id="confirmEmail" type="email" required autoComplete="off" value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)} placeholder={t.email_confirm_ph}
                className={`${inputClass} ${emailMatch === false ? "border-destructive/60" : emailMatch === true ? "border-success/60" : ""}`} />
              <FieldStatus ok={emailMatch} msg={emailMatch === true ? t.match_ok : t.match_err} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.phone_label}
              </Label>
              <Input id="phone" type="tel" autoComplete="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder={t.phone_ph} className={inputClass} />
            </div>

            {phone.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="confirmPhone" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {t.phone_confirm_label}
                </Label>
                <Input id="confirmPhone" type="tel" autoComplete="off" value={confirmPhone}
                  onChange={(e) => setConfirmPhone(e.target.value)} placeholder={t.phone_confirm_ph}
                  className={`${inputClass} ${phoneMatch === false ? "border-destructive/60" : phoneMatch === true ? "border-success/60" : ""}`} />
                <FieldStatus ok={phoneMatch} msg={phoneMatch === true ? t.match_ok : t.match_err} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.password_label} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} required
                  autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder={t.password_ph}
                  className={`${inputClass} pr-11 ${password.length > 0 && !passStrong ? "border-destructive/60" : password.length >= 8 ? "border-success/60" : ""}`} />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && <FieldStatus ok={passStrong} msg={passStrong ? t.strong_pass : t.weak_pass} />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.password_confirm_label} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirm ? "text" : "password"} required
                  autoComplete="new-password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.password_confirm_ph}
                  className={`${inputClass} pr-11 ${passMatch === false ? "border-destructive/60" : passMatch === true ? "border-success/60" : ""}`} />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldStatus ok={passMatch} msg={passMatch === true ? t.match_ok : t.match_err} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> {uiText("Código de Convite", "Invite Code", "Código de invitación")} <span className="text-destructive">*</span>
              </Label>
              <Input id="inviteCode" type="text" value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="NEXOS-XXXX-XXXX"
                className={`${inputClass} uppercase tracking-widest`} />
              <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                {uiText("Obrigatório durante o período de acesso exclusivo", "Required during the exclusive access period", "Obligatorio durante el período de acceso exclusivo")}
              </p>
            </div>

            {referralCode && (
              <div className="border border-success/30 bg-success/5 px-3 py-2 flex items-center gap-2">
                <Gift className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="font-mono text-xs text-success uppercase tracking-widest">
                  {uiText("Indicado por:", "Referred by:", "Recomendado por:")} <strong>{referralCode}</strong> — {uiText("prioridade garantida!", "priority guaranteed!", "¡prioridad garantizada!")}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="plan" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.plan_label}
              </Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="font-mono rounded-none bg-background/50 border-border/50 focus:ring-primary focus:border-primary transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-primary/20 backdrop-blur-xl bg-card/80">
                  <SelectItem value="solo" className="font-mono uppercase text-xs tracking-wider focus:bg-primary/20 focus:text-primary">{t.plan_solo}</SelectItem>
                  <SelectItem value="agency" className="font-mono uppercase text-xs tracking-wider focus:bg-primary/20 focus:text-primary">{t.plan_agency}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit"
              className="w-full rounded-none font-mono uppercase tracking-widest font-bold btn-weapon-primary mt-2 h-12"
              disabled={registerMutation.isPending || !canSubmit}>
              {registerMutation.isPending ? t.submitting : t.submit}
            </Button>
          </form>

          <div className="mt-6 text-center relative z-10 border-t border-border/30 pt-6">
            <button onClick={() => setMode("gate")} className="font-mono text-xs text-muted-foreground/40 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" /> {uiText("Escolher outra opção", "Choose another option", "Elegir otra opción")}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{t.have_account} </span>
          <Link href="/login">
            <span className="text-xs text-primary uppercase font-bold hover:text-white hover:drop-shadow-[0_0_5px_hsl(var(--primary))] transition-all cursor-pointer tracking-wide ml-2">
              {t.login_link}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
