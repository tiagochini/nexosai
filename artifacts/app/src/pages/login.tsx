import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useAppI18n } from "@/lib/i18n";
import { GuestLanguageSwitcher } from "@/components/guest-language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import nexosLogo from "/nexos-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const tr = useAppI18n();
  const t = tr.login;

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        const raw = data as typeof data & { refreshToken?: string };
        setToken(data.accessToken, raw.refreshToken);
        toast.success(t.success);
        setLocation("/");
      },
      onError: (error: Error) => {
        toast.error(error.message || t.error);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen auth-bg-gradient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10 animate-in fade-in blur-in duration-1000">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full w-32 h-32 m-auto" />
          <img
            src={nexosLogo}
            alt="NexOS"
            className="h-40 w-40 md:h-48 md:w-48 object-contain mb-2 relative z-10"
            style={{ imageRendering: "crisp-edges", filter: "drop-shadow(0 0 20px hsl(var(--primary)/0.6))" }}
          />
          <p className="text-primary text-sm uppercase tracking-[0.3em] font-mono mt-4 font-bold drop-shadow-[0_0_5px_hsl(var(--primary)/0.8)]">
            {t.tagline}
          </p>
        </div>

        {/* Card */}
        <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] group">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow" />

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.email_label}
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="font-mono bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.3)] rounded-none transition-all"
              />
            </div>

            {/* Password with show/hide */}
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {t.password_label}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.3)] rounded-none transition-all pr-11"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                  aria-label={showPassword ? t.hide_password : t.show_password}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full rounded-none font-mono uppercase tracking-widest font-bold btn-weapon-primary mt-4"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? t.submitting : t.submit}
            </Button>
          </form>

          <div className="mt-8 text-center relative z-10 border-t border-border/30 pt-6">
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{t.no_account} </span>
            <Link href="/register">
              <span className="text-xs text-primary uppercase font-bold hover:text-white hover:drop-shadow-[0_0_5px_hsl(var(--primary))] transition-all cursor-pointer tracking-wide ml-2">
                {t.register}
              </span>
            </Link>
          </div>
        </div>
        <div className="mt-4">
          <GuestLanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
