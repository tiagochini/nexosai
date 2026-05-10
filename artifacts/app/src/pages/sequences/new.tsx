import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateSequence, SequenceInputModel, useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Zap } from "lucide-react";

export default function NewSequence() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [model, setModel] = useState<string>("formula_de_lancamento");
  const [totalDays, setTotalDays] = useState("14");
  const [productName, setProductName] = useState("");
  const [campaignId, setCampaignId] = useState("");

  const { data: campaignsData } = useListCampaigns({
    query: {
      queryKey: getListCampaignsQueryKey()
    }
  });

  const createMutation = useCreateSequence({
    mutation: {
      onSuccess: (data) => {
        toast.success("Sequência registrada com sucesso.");
        setLocation(`/sequences`);
      },
      onError: () => {
        toast.error("Erro ao registrar sequência.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        name,
        model: model as SequenceInputModel,
        totalDays: parseInt(totalDays, 10) || 14,
        productName: productName || undefined,
        campaignId: campaignId || undefined
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="border-b border-border/50 pb-6">
        <Link href="/sequences">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />
            Abortar Operação
          </Button>
        </Link>
        <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground flex items-center gap-3">
          Definir Matriz de Disparo
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Configure o fluxo temporal de e-mails, mensagens e posts.</p>
      </div>

      <div className="card-weapon border border-border/50 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="space-y-3">
            <Label htmlFor="name" className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-slow"></span>
              Nome da Matriz
            </Label>
            <Input 
              id="name" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 text-lg rounded-none px-4 transition-all"
              placeholder="Ex: Aquecimento - Lançamento Semente"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/30">
            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Modelo Estrutural</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="font-mono rounded-none h-12 bg-background/60 border-border/50 focus:ring-primary focus:border-primary transition-all">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-primary/20 bg-card/90 backdrop-blur-xl">
                  <SelectItem value="plf" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">PLF</SelectItem>
                  <SelectItem value="formula_de_lancamento" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">Fórmula de Lançamento</SelectItem>
                  <SelectItem value="semente" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">Lançamento Semente</SelectItem>
                  <SelectItem value="afiliado" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">Lançamento Afiliado</SelectItem>
                  <SelectItem value="perpetual" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">Perpétuo</SelectItem>
                  <SelectItem value="custom" className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary text-primary">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="totalDays" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Duração (Dias)</Label>
              <Input 
                id="totalDays" 
                type="number"
                min="1"
                required
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
                className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 rounded-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/30">
            <div className="space-y-3">
              <Label htmlFor="campaignId" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Vincular a Campanha (Opcional)</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className="font-mono rounded-none h-12 bg-background/60 border-border/50 focus:ring-primary focus:border-primary transition-all">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-primary/20 bg-card/90 backdrop-blur-xl">
                  <SelectItem value="none" className="font-mono uppercase text-xs text-muted-foreground focus:bg-primary/20">Nenhuma</SelectItem>
                  {campaignsData?.campaigns?.map(c => (
                    <SelectItem key={c.id} value={c.id} className="font-mono uppercase text-xs tracking-widest focus:bg-primary/20 focus:text-primary">{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="productName" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Nome do Produto (Opcional)</Label>
              <Input 
                id="productName" 
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="font-mono bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary h-12 rounded-none transition-all"
                placeholder="Ex: Fórmula Enriquecimento"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 flex justify-end">
            <Button 
              type="submit" 
              className="rounded-none font-mono uppercase tracking-widest font-bold h-12 px-8 btn-weapon-primary gap-2"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Processando..." : <><Zap className="h-4 w-4" /> Gerar Estrutura</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
