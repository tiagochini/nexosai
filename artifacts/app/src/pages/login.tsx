import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setToken(data.accessToken);
        toast.success("Acesso autorizado.");
        setLocation("/");
      },
      onError: (error) => {
        toast.error("Acesso negado. Verifique as credenciais.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-primary">
          <Activity className="h-12 w-12 mb-4" />
          <h1 className="text-3xl font-mono font-bold tracking-tight uppercase">NexOS AI</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest mt-2">Missão Controle</p>
        </div>

        <div className="border border-border bg-card p-8 shadow-2xl relative">
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary"></div>
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary"></div>

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <Button 
              type="submit" 
              className="w-full rounded-none font-mono uppercase tracking-wider font-bold"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Autenticando..." : "Iniciar Sessão"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-xs text-muted-foreground">Solicitar novo acesso? </span>
            <Link href="/register">
              <span className="text-xs text-primary uppercase font-bold hover:underline cursor-pointer">Registrar-se</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
