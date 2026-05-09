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
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Iniciar Nova Missão</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure os parâmetros base da campanha de lançamento.</p>
      </div>

      <div className="border border-border bg-card p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Codinome da Campanha</Label>
            <Input 
              id="title" 
              required 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-mono bg-background border-border rounded-none"
              placeholder="Ex: Lançamento Semente Q3"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Tipo de Operação</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="font-mono rounded-none">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="launch" className="font-mono uppercase text-xs tracking-wider">Lançamento</SelectItem>
                  <SelectItem value="evergreen" className="font-mono uppercase text-xs tracking-wider">Perpétuo</SelectItem>
                  <SelectItem value="relaunch" className="font-mono uppercase text-xs tracking-wider">Relançamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Alvo Financeiro (Track)</Label>
              <Select value={track} onValueChange={setTrack}>
                <SelectTrigger className="font-mono rounded-none">
                  <SelectValue placeholder="Selecione o track" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="six_digits" className="font-mono uppercase text-xs tracking-wider">6 Dígitos (R$100k - R$999k)</SelectItem>
                  <SelectItem value="eight_digits" className="font-mono uppercase text-xs tracking-wider">8 Dígitos (R$10M - R$99M)</SelectItem>
                  <SelectItem value="ten_digits" className="font-mono uppercase text-xs tracking-wider">10 Dígitos (R$100M+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenueTarget" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Meta de Faturamento Estimada (Opcional)</Label>
            <Input 
              id="revenueTarget" 
              type="text"
              value={revenueTarget}
              onChange={(e) => setRevenueTarget(e.target.value)}
              className="font-mono bg-background border-border rounded-none"
              placeholder="Ex: 500000"
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <Button 
              type="submit" 
              className="rounded-none font-mono uppercase tracking-wider font-bold"
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
