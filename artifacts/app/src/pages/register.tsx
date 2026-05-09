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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={nexosLogo} alt="NexOS AI" className="h-32 w-32 object-contain mb-2" style={{ imageRendering: "crisp-edges" }} />
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-mono">Novo Registro</p>
        </div>

        <div className="border border-border bg-card p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary"></div>
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary"></div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Designação (Nome)</Label>
              <Input 
                id="name" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono bg-background border-border focus-visible:ring-primary rounded-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Identificação (Email)</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="font-mono bg-background border-border focus-visible:ring-primary rounded-none"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Código de Acesso (Senha)</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono bg-background border-border focus-visible:ring-primary rounded-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Nível Operacional (Plano)</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="font-mono rounded-none">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo" className="font-mono uppercase text-xs tracking-wider">Lançador Solo</SelectItem>
                  <SelectItem value="agency" className="font-mono uppercase text-xs tracking-wider">Agência (Múltiplos Especialistas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-none font-mono uppercase tracking-wider font-bold"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Processando..." : "Gerar Acesso"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-xs text-muted-foreground">Já possui autorização? </span>
            <Link href="/login">
              <span className="text-xs text-primary uppercase font-bold hover:underline cursor-pointer">Autenticar-se</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
