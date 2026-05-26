import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useAppI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function FieldStatus({ ok, msg }: { ok: boolean | null; msg: string }) {
  if (ok === null) return null;
  return (
    <div className={`flex items-center gap-1.5 mt-1 ${ok ? "text-success" : "text-destructive"}`}>
      {ok ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
      <span className="font-mono text-xs uppercase tracking-widest">{msg}</span>
    </div>
  );
}

export default function Register() {
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
  const [, setLocation]                   = useLocation();
  const { setToken }                      = useAuth();
  const tr = useAppI18n();
  const t = tr.register;

  // Derived validation
  const emailMatch    = confirmEmail.length > 0 ? email === confirmEmail : null;
  const phoneMatch    = confirmPhone.length > 0 ? phone === confirmPhone : null;
  const passStrong    = password.length >= 8;
  const passMatch     = confirmPassword.length > 0 ? password === confirmPassword : null;

  const canSubmit =
    name.trim().length >= 2 &&
    email.trim().length > 0 &&
    emailMatch === true &&
    passStrong &&
    passMatch === true &&
    (phone.length === 0 || phoneMatch === true);

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        const raw = data as typeof data & { refreshToken?: string };
        setToken(data.accessToken, raw.refreshToken);
        toast.success(t.success);
        setLocation("/welcome");
      },
      onError: () => {
        toast.error(t.error);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    registerMutation.mutate({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        planSlug: plan,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      },
    });
  };

  const inputClass =
    "font-mono bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.3)] rounded-none transition-all";

  return (
    <div className="min-h-screen auth-bg-gradient flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-md relative z-10 animate-in fade-in blur-in duration-1000">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full w-32 h-32 m-auto" />
          <img
            src={nexosLogo}
            alt="NexOS AI"
            className="h-32 w-32 object-contain mb-2 relative z-10"
            style={{ imageRendering: "crisp-edges", filter: "drop-shadow(0 0 20px hsl(var(--primary)/0.6))" }}
          />
          <p className="text-primary text-sm uppercase tracking-[0.3em] font-mono mt-3 font-bold drop-shadow-[0_0_5px_hsl(var(--primary)/0.8)]">
            {t.tagline}
          </p>
        </div>

        {/* Card */}
        <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] group">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">

            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.name_label} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.name_ph}
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.email_label} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.email_ph}
                className={inputClass}
              />
            </div>

            {/* Confirmar Email */}
            <div className="space-y-2">
              <Label htmlFor="confirmEmail" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.email_confirm_label} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirmEmail"
                type="email"
                required
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={t.email_confirm_ph}
                className={`${inputClass} ${emailMatch === false ? "border-destructive/60 focus-visible:border-destructive" : emailMatch === true ? "border-success/60" : ""}`}
              />
              <FieldStatus
                ok={emailMatch}
                msg={emailMatch === true ? t.match_ok : t.match_err}
              />
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.phone_label}
              </Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phone_ph}
                className={inputClass}
              />
            </div>

            {/* Confirmar Telefone */}
            {phone.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="confirmPhone" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {t.phone_confirm_label}
                </Label>
                <Input
                  id="confirmPhone"
                  type="tel"
                  autoComplete="off"
                  value={confirmPhone}
                  onChange={(e) => setConfirmPhone(e.target.value)}
                  placeholder={t.phone_confirm_ph}
                  className={`${inputClass} ${phoneMatch === false ? "border-destructive/60" : phoneMatch === true ? "border-success/60" : ""}`}
                />
                <FieldStatus
                  ok={phoneMatch}
                  msg={phoneMatch === true ? t.match_ok : t.match_err}
                />
              </div>
            )}

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.password_label} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.password_ph}
                  className={`${inputClass} pr-11 ${password.length > 0 && !passStrong ? "border-destructive/60" : password.length >= 8 ? "border-success/60" : ""}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <FieldStatus
                  ok={passStrong}
                  msg={passStrong ? t.strong_pass : t.weak_pass}
                />
              )}
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.password_confirm_label} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.password_confirm_ph}
                  className={`${inputClass} pr-11 ${passMatch === false ? "border-destructive/60" : passMatch === true ? "border-success/60" : ""}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldStatus
                ok={passMatch}
                msg={passMatch === true ? t.match_ok : t.match_err}
              />
            </div>

            {/* Plano */}
            <div className="space-y-2">
              <Label htmlFor="plan" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.plan_label}
              </Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="font-mono rounded-none bg-background/50 border-border/50 focus:ring-primary focus:border-primary transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-primary/20 backdrop-blur-xl bg-card/80">
                  <SelectItem value="solo" className="font-mono uppercase text-xs tracking-wider focus:bg-primary/20 focus:text-primary">
                    {t.plan_solo}
                  </SelectItem>
                  <SelectItem value="agency" className="font-mono uppercase text-xs tracking-wider focus:bg-primary/20 focus:text-primary">
                    {t.plan_agency}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full rounded-none font-mono uppercase tracking-widest font-bold btn-weapon-primary mt-2 h-12"
              disabled={registerMutation.isPending || !canSubmit}
            >
              {registerMutation.isPending ? t.submitting : t.submit}
            </Button>
          </form>

          <div className="mt-6 text-center relative z-10 border-t border-border/30 pt-6">
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{t.have_account} </span>
            <Link href="/login">
              <span className="text-xs text-primary uppercase font-bold hover:text-white hover:drop-shadow-[0_0_5px_hsl(var(--primary))] transition-all cursor-pointer tracking-wide ml-2">
                {t.login_link}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
