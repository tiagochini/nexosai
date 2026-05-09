import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCampaign, CampaignInputType, CampaignInputTrack } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("launch");
  const [track, setTrack] = useState<string>("six_digits");
  const [revenueTarget, setRevenueTarget] = useState("");

  const createMutation = useCreateCampaign({
    mutation: {
      onSuccess: (data) => {
        toast.success("Campanha registrada com sucesso.");
        setLocation(`/campaigns/${data.campaign.id}`);
      },
      onError: () => {
        toast.error("Erro ao registrar campanha.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        title,
        type: type as CampaignInputType,
        track: track as CampaignInputTrack,
        revenueTarget: revenueTarget || undefined
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="border-b border-border/50 pb-6">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-[10px] tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />
            Abortar Inicialização
          </Button>
        </Link>
        <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground">Iniciar Nova Missão</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Configure os parâmetros base da operação tática.</p>
      </div>

      <div className="border border-primary/20 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden card-weapon">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="space-y-3">
            <Label htmlFor="title" className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-slow"></span>
              Codinome da Campanha
            </Label>
            <Input 
              id="title" 
              required 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 text-lg rounded-none px-4"
              placeholder="Ex: Lançamento Semente Q3"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/30">
            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Tipo de Operação</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="font-mono rounded-none h-12 bg-background/60 border-border/50 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-primary/20 bg-card/90 backdrop-blur-xl">
                  <SelectItem value="launch" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">Lançamento</SelectItem>
                  <SelectItem value="evergreen" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">Perpétuo</SelectItem>
                  <SelectItem value="relaunch" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">Relançamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Alvo Financeiro (Track)</Label>
              <Select value={track} onValueChange={setTrack}>
                <SelectTrigger className="font-mono rounded-none h-12 bg-background/60 border-border/50 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="Selecione o track" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-primary/20 bg-card/90 backdrop-blur-xl">
                  <SelectItem value="six_digits" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary text-blue-400">6 Dígitos (R$100k - 999k)</SelectItem>
                  <SelectItem value="eight_digits" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary text-purple-400">8 Dígitos (R$10M - 99M)</SelectItem>
                  <SelectItem value="ten_digits" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary text-red-400">10 Dígitos (R$100M+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border/30">
            <Label htmlFor="revenueTarget" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Meta de Faturamento Estimada (Opcional)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">R$</span>
              <Input 
                id="revenueTarget" 
                type="text"
                value={revenueTarget}
                onChange={(e) => setRevenueTarget(e.target.value)}
                className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 rounded-none pl-10"
                placeholder="500.000,00"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 flex justify-end">
            <Button 
              type="submit" 
              className="rounded-none font-mono uppercase tracking-widest font-bold h-12 px-8 btn-weapon-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Processando..." : "Confirmar Inicialização"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
