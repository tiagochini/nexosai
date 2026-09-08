import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Globe, Server, CheckCircle2, XCircle, ChevronRight, Search, Plus, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ProviderMode = "automatic" | "guided" | "connect_existing";
type ProviderCapability = "availability" | "registration" | "renewal" | "dns" | "hosting";

interface DomainProvider {
  id: string;
  name: string;
  mode: ProviderMode;
  capabilities: ProviderCapability[];
  setupInstructions: string[];
  renewalOwner: "platform" | "customer" | "provider_account";
  configured: boolean;
}

export function DomainsTab() {
  const queryClient = useQueryClient();
  const [domainCheck, setDomainCheck] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<{ available: boolean; price?: number } | null>(null);
  
  const { data: providersData, isLoading } = useQuery<{ providers: DomainProvider[] }>({
    queryKey: ["/api/domains/providers"],
    queryFn: () => customFetch("/api/domains/providers"),
  });

  const { data: targetsData } = useQuery<{ targets: DomainProvider[] }>({
    queryKey: ["/api/domains/deployment-targets"],
    queryFn: () => customFetch("/api/domains/deployment-targets"),
  });

  const checkMutation = useMutation({
    mutationFn: (domain: string) => customFetch<{ available: boolean }>("/api/domains/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, provider: "generic", idempotencyKey: crypto.randomUUID() }),
    }),
    onSuccess: (data) => {
      setAvailabilityResult({ available: data.available });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao verificar domínio.");
    }
  });

  const handleCheck = () => {
    if (!domainCheck.trim()) return;
    setAvailabilityResult(null);
    checkMutation.mutate(domainCheck.trim());
  };

  const connectMutation = useMutation({
    mutationFn: (data: { domain: string; provider: string }) => customFetch("/api/domains/connect-existing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, consent: true }),
    }),
    onSuccess: () => {
      toast.success("Domínio conectado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao conectar domínio.");
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  const providers = providersData?.providers || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration & Availability */}
        <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden card-weapon">
          <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Registrars & Disponibilidade</span>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex gap-2">
              <Input
                placeholder="nexos.ai"
                className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary rounded-none"
                value={domainCheck}
                onChange={(e) => setDomainCheck(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              />
              <Button onClick={handleCheck} disabled={checkMutation.isPending} className="btn-weapon-primary rounded-none px-6">
                {checkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            
            {availabilityResult && (
              <div className={`p-4 border ${availabilityResult.available ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex items-center gap-3">
                  {availabilityResult.available ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <div className={`font-mono text-sm font-bold ${availabilityResult.available ? 'text-success' : 'text-destructive'}`}>
                      {availabilityResult.available ? "Domínio Disponível" : "Domínio Indisponível"}
                    </div>
                    {availabilityResult.available && (
                      <div className="font-mono text-xs text-muted-foreground mt-1">
                        Use um provedor automático para registrar.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-border/30">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Provedores Habilitados</div>
              {providers.filter(p => p.capabilities.includes("registration") || p.capabilities.includes("availability")).map(p => (
                <div key={p.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border border-border/30 bg-background/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground/90">{p.name}</span>
                      {p.configured ? (
                        <Badge variant="outline" className="rounded-none border-success/30 text-success bg-success/10 font-mono text-[9px] uppercase">Pronto</Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-none border-muted-foreground/30 text-muted-foreground bg-muted/10 font-mono text-[9px] uppercase">Inativo</Badge>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1">
                      Modo: <span className="text-primary">{p.mode}</span>
                    </div>
                  </div>
                  
                  {p.mode === "connect_existing" && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="btn-weapon-outline rounded-none font-mono text-[10px] uppercase">
                          Conectar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-none border-primary/30 bg-card/95 backdrop-blur-xl">
                        <DialogHeader>
                          <DialogTitle className="font-mono uppercase tracking-widest text-primary text-sm">Conectar Domínio Existente</DialogTitle>
                          <DialogDescription className="font-mono text-xs text-muted-foreground mt-2">
                            {p.setupInstructions.join(" ")}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <Input
                            placeholder="seu-dominio.com"
                            className="font-mono bg-background/60 rounded-none border-border/50"
                            id="existing-domain"
                          />
                        </div>
                        <DialogFooter>
                          <Button 
                            className="btn-weapon-primary rounded-none font-mono uppercase text-xs"
                            onClick={() => {
                              const val = (document.getElementById("existing-domain") as HTMLInputElement).value;
                              if (val) connectMutation.mutate({ domain: val, provider: p.id });
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" /> Vincular
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DNS & Deployment Targets */}
        <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden card-weapon">
          <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">DNS & Hosting Targets</span>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-primary/5 border border-primary/20 p-4 mb-4">
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Os alvos de implantação são usados para hospedar landing pages, funis de conversão e relatórios de inteligência.
              </p>
            </div>

            {targetsData?.targets.map(target => (
               <div key={target.id} className="p-4 border border-border/30 bg-background/20 space-y-3">
                 <div className="flex items-center justify-between">
                   <div className="font-mono text-sm font-bold text-foreground">{target.name}</div>
                   {target.configured ? (
                     <Badge variant="outline" className="rounded-none border-success/30 text-success bg-success/10 font-mono text-[9px] uppercase">Integrado</Badge>
                   ) : (
                     <Badge variant="outline" className="rounded-none border-warning/30 text-warning bg-warning/10 font-mono text-[9px] uppercase">Pendente</Badge>
                   )}
                 </div>
                 <div className="space-y-1">
                   {target.setupInstructions.map((instruction, idx) => (
                     <div key={idx} className="flex items-start gap-2">
                       <ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                       <span className="font-mono text-xs text-muted-foreground">{instruction}</span>
                     </div>
                   ))}
                 </div>
               </div>
            ))}

            {targetsData?.targets?.length === 0 && (
              <div className="text-center p-8 border border-dashed border-border/50 text-muted-foreground font-mono text-xs">
                Nenhum alvo de implantação habilitado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}