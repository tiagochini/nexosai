import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateSequence, SequenceInputModel, useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

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
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/sequences">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Definir Matriz de Disparo</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Configure o fluxo temporal de e-mails, mensagens e posts.</p>
      </div>

      <div className="border border-border bg-card p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Nome da Matriz</Label>
            <Input 
              id="name" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono bg-background border-border rounded-none"
              placeholder="Ex: Aquecimento - Lançamento Semente"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Modelo Estrutural</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="font-mono rounded-none">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plf" className="font-mono uppercase text-xs tracking-wider">PLF</SelectItem>
                  <SelectItem value="formula_de_lancamento" className="font-mono uppercase text-xs tracking-wider">Fórmula de Lançamento</SelectItem>
                  <SelectItem value="semente" className="font-mono uppercase text-xs tracking-wider">Lançamento Semente</SelectItem>
                  <SelectItem value="afiliado" className="font-mono uppercase text-xs tracking-wider">Lançamento Afiliado</SelectItem>
                  <SelectItem value="perpetual" className="font-mono uppercase text-xs tracking-wider">Perpétuo</SelectItem>
                  <SelectItem value="custom" className="font-mono uppercase text-xs tracking-wider">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalDays" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Duração (Dias)</Label>
              <Input 
                id="totalDays" 
                type="number"
                min="1"
                required
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
                className="font-mono bg-background border-border rounded-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaignId" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Vincular a Campanha (Opcional)</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="font-mono rounded-none">
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="font-mono uppercase text-xs text-muted-foreground">Nenhuma</SelectItem>
                {campaignsData?.campaigns?.map(c => (
                  <SelectItem key={c.id} value={c.id} className="font-mono uppercase text-xs tracking-wider">{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productName" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Nome do Produto (Opcional)</Label>
            <Input 
              id="productName" 
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="font-mono bg-background border-border rounded-none"
              placeholder="Ex: Fórmula Enriquecimento"
            />
          </div>

          <div className="pt-6 border-t border-border flex justify-end">
            <Button 
              type="submit" 
              className="rounded-none font-mono uppercase tracking-wider font-bold"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Processando..." : "Gerar Estrutura"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
