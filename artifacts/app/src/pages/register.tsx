import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import nexosLogo from "/nexos-logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("solo");
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setToken(data.accessToken);
        toast.success("Credenciais estabelecidas com sucesso.");
        setLocation("/");
      },
      onError: (error) => {
        toast.error("Falha ao criar acesso.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: { name, email, password, planSlug: plan } });
  };

  return (
    <div className="min-h-screen auth-bg-gradient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10 animate-in fade-in blur-in duration-1000">
        <div className="flex flex-col items-center mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full w-32 h-32 m-auto"></div>
          <img src={nexosLogo} alt="NexOS AI" className="h-40 w-40 md:h-48 md:w-48 object-contain mb-2 relative z-10" style={{ imageRendering: "crisp-edges", filter: "drop-shadow(0 0 20px hsl(var(--primary)/0.6))" }} />
          <p className="text-primary text-sm uppercase tracking-[0.3em] font-mono mt-4 font-bold drop-shadow-[0_0_5px_hsl(var(--primary)/0.8)]">Novo Registro</p>
        </div>

        <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] group">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary))] transition-shadow"></div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Designação (Nome)</Label>
              <Input 
                id="name" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.3)] rounded-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Identificação (Email)</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="font-mono bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.3)] rounded-none transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Código de Acesso (Senha)</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.3)] rounded-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Nível Operacional (Plano)</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="font-mono rounded-none bg-background/50 border-border/50 focus:ring-primary focus:border-primary focus:shadow-[0_0_10px_hsl(var(--primary)/0.3)] transition-all">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-primary/20 backdrop-blur-xl bg-card/80">
                  <SelectItem value="solo" className="font-mono uppercase text-xs tracking-wider focus:bg-primary/20 focus:text-primary">Lançador Solo</SelectItem>
                  <SelectItem value="agency" className="font-mono uppercase text-xs tracking-wider focus:bg-primary/20 focus:text-primary">Agência (Múltiplos Especialistas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-none font-mono uppercase tracking-widest font-bold btn-weapon-primary mt-4"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Processando..." : "Gerar Acesso"}
            </Button>
          </form>

          <div className="mt-8 text-center relative z-10 border-t border-border/30 pt-6">
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">Já possui autorização? </span>
            <Link href="/login">
              <span className="text-xs text-primary uppercase font-bold hover:text-white hover:drop-shadow-[0_0_5px_hsl(var(--primary))] transition-all cursor-pointer tracking-wide ml-2">Autenticar-se</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
