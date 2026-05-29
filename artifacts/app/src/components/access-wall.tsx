import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { toast } from "sonner";
import { Lock, ChevronRight, RefreshCw, CheckCheck, Users, MessageCircle } from "lucide-react";
import nexosLogo from "/nexos-logo.png";

// ── Waitlist form ─────────────────────────────────────────────────────────────
function WaitlistForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () =>
      customFetch<{ joined: boolean; message: string }>("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, whatsapp, source: "access_wall" }),
      }),
    onSuccess: (data) => {
      setSent(true);
      toast.success(data.message ?? "Você entrou na lista!");
      setTimeout(onSuccess, 3000);
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao entrar na lista."),
  });

  if (sent) {
    return (
      <div className="text-center space-y-2 py-4">
        <CheckCheck className="h-6 w-6 text-success mx-auto" />
        <p className="font-mono text-sm text-success font-bold uppercase tracking-widest">Você está na lista!</p>
        <p className="font-mono text-xs text-muted-foreground/60">Entraremos em contato via WhatsApp quando o acesso for liberado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Seu nome completo"
        className="w-full px-3 py-2.5 bg-black/40 border border-border/50 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50"
      />
      <input
        type="tel"
        value={whatsapp}
        onChange={e => setWhatsapp(e.target.value)}
        placeholder="WhatsApp (ex: 11999999999)"
        className="w-full px-3 py-2.5 bg-black/40 border border-border/50 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50"
      />
      <button
        onClick={() => { if (name.trim() && whatsapp.trim()) mutation.mutate(); }}
        disabled={!name.trim() || !whatsapp.trim() || mutation.isPending}
        className="w-full py-3 font-mono text-[12px] uppercase tracking-widest border border-border/50 bg-muted/10 hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      >
        {mutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Entrar na Lista de Espera →"}
      </button>
    </div>
  );
}

// ── Main AccessWall ───────────────────────────────────────────────────────────
export function AccessWall({ onAccessGranted }: { onAccessGranted: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const redeemMutation = useMutation({
    mutationFn: (c: string) =>
      customFetch<{ ok: boolean; planName: string }>("/api/billing/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      }),
    onSuccess: (data) => {
      setRedeemSuccess(true);
      toast.success(`Acesso ${data.planName} ativado! Bem-vindo(a) à NexOS.`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/balance"] });
      setTimeout(onAccessGranted, 1500);
    },
    onError: (err: Error) => toast.error(err.message ?? "Código inválido ou já utilizado."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, #050508 60%)" }}>

      <div className="w-full max-w-md space-y-8">

        {/* Logo + header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={nexosLogo} alt="NexOS AI" className="h-10 w-auto" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
              <Lock className="h-3 w-3" /> Acesso Exclusivo
            </div>
            <h1 className="font-mono text-2xl font-bold uppercase tracking-tighter text-foreground mt-3">
              Somente para Convidados
            </h1>
            <p className="font-mono text-xs text-muted-foreground/60 leading-relaxed max-w-sm mx-auto">
              A plataforma está em período de acesso exclusivo.<br />
              O carrinho abre em breve para os da lista.
            </p>
          </div>
        </div>

        {/* Code redemption */}
        <div className="border border-primary/20 bg-primary/3 p-6 space-y-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary/70 text-center">
            Se você recebeu um código de acesso
          </div>
          {redeemSuccess ? (
            <div className="text-center space-y-2 py-2">
              <CheckCheck className="h-7 w-7 text-success mx-auto" />
              <p className="font-mono text-sm text-success font-bold">Acesso ativado! Entrando...</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && code.trim() && redeemMutation.mutate(code.trim())}
                placeholder="NEXOS-XXXX-XXXX"
                className="flex-1 px-3 py-3 bg-black/60 border border-primary/30 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 uppercase tracking-widest"
              />
              <button
                onClick={() => redeemMutation.mutate(code.trim())}
                disabled={!code.trim() || redeemMutation.isPending}
                className="px-5 py-3 font-mono text-[12px] uppercase tracking-widest border border-primary bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-40 shrink-0"
              >
                {redeemMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border/30" />
          <span className="font-mono text-[11px] text-muted-foreground/30 uppercase tracking-widest">ou</span>
          <div className="flex-1 h-px bg-border/30" />
        </div>

        {/* Waitlist / WhatsApp */}
        {!showWaitlist ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowWaitlist(true)}
              className="flex flex-col items-center gap-2 border border-border/40 bg-card/20 hover:bg-card/40 p-4 transition-colors text-center"
            >
              <Users className="h-4 w-4 text-muted-foreground/60" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Lista de Espera</div>
              <div className="font-mono text-[10px] text-muted-foreground/40">Seja avisado quando abrir</div>
            </button>
            <a
              href="https://chat.whatsapp.com/H49MCBiw2x92E8YoQMIRXH"
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-2 border border-border/40 bg-card/20 hover:bg-card/40 p-4 transition-colors text-center"
            >
              <MessageCircle className="h-4 w-4 text-muted-foreground/60" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Grupo VIP</div>
              <div className="font-mono text-[10px] text-muted-foreground/40">Acesso antecipado e conteúdo</div>
            </a>
          </div>
        ) : (
          <div className="border border-border/40 bg-card/20 p-5 space-y-4">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60 text-center">Lista de Espera</div>
            <WaitlistForm onSuccess={() => setShowWaitlist(false)} />
            <button onClick={() => setShowWaitlist(false)} className="w-full text-center font-mono text-[11px] text-muted-foreground/40 hover:text-muted-foreground">
              ← Voltar
            </button>
          </div>
        )}

        {/* Footer note */}
        <p className="font-mono text-[10px] text-muted-foreground/25 text-center uppercase tracking-widest">
          NexOS AI · Sua conta está ativa · Aguardando autorização de acesso
        </p>
      </div>
    </div>
  );
}
