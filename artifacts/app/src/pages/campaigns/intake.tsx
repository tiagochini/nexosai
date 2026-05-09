import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useGetIntake, useSaveIntake, useGetIntakeScore, getGetIntakeQueryKey, getGetIntakeScoreQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, AlertCircle, Database } from "lucide-react";
import { toast } from "sonner";

export default function CampaignIntake() {
  const [match, params] = useRoute("/campaigns/:id/intake");
  const campaignId = params?.id || "";
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data, isLoading } = useGetIntake(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetIntakeQueryKey(campaignId)
    }
  });

  const { data: scoreData } = useGetIntakeScore(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetIntakeScoreQueryKey(campaignId)
    }
  });

  useEffect(() => {
    if (data?.intakeData) {
      setFormData(data.intakeData as Record<string, string>);
    }
  }, [data]);

  const saveMutation = useSaveIntake({
    mutation: {
      onSuccess: () => {
        toast.success("Dados salvos e sincronizados com a IA.");
        queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
      },
      onError: () => {
        toast.error("Falha na sincronização de dados.");
      }
    }
  });

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate({
      campaignId,
      data: {
        intakeData: formData
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-96 w-full bg-muted/20" />
      </div>
    );
  }

  const completeness = data?.completeness || 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border/50 pb-6 gap-6">
        <div>
          <Link href={`/campaigns/${campaignId}`}>
            <Button variant="ghost" size="sm" className="font-mono uppercase text-[10px] tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-2" />
              Retornar à Missão
            </Button>
          </Link>
          <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground flex items-center gap-3">
            Intake Estratégico
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Alimentação de base de dados cognitiva</p>
        </div>
        
        <div className="flex flex-col items-end gap-3 text-right bg-card/30 p-4 border border-border/40 min-w-[250px]">
          <div className="flex justify-between w-full">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Progresso</span>
            <span className="font-mono text-[10px] font-bold text-primary">{completeness}%</span>
          </div>
          <Progress value={completeness} className="w-full h-1.5 rounded-none bg-muted/30 [&>div]:bg-primary [&>div]:shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
          
          {scoreData && (
            <div className="w-full flex justify-between items-center mt-2 pt-2 border-t border-border/30">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Score IA</span>
              <span className="font-mono text-xs uppercase font-bold text-success badge-glow-green px-2 py-0.5 border border-success/30 bg-success/10">
                {scoreData.score} - {scoreData.label}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card-weapon border border-border/50 bg-card/60 backdrop-blur-md">
        <div className="p-5 border-b border-border/50 bg-primary/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <div className="flex items-center gap-3 text-primary font-mono text-[10px] uppercase tracking-widest">
            <Database className="h-4 w-4" />
            <span>Sincronização em tempo real ativa. A qualidade das respostas determina a letalidade da copy.</span>
          </div>
        </div>

        <div className="p-8 space-y-10">
          {data?.questions?.map((q) => (
            <div key={q.key} className="space-y-3 group">
              <Label className="font-mono text-xs uppercase tracking-widest text-foreground flex items-center gap-2 group-focus-within:text-primary transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-focus-within:bg-primary group-focus-within:shadow-[0_0_5px_hsl(var(--primary))] transition-all"></span>
                {q.label} {q.required && <span className="text-primary">*</span>}
              </Label>
              {q.type === 'textarea' ? (
                <Textarea 
                  value={formData[q.key] || ""}
                  onChange={(e) => handleChange(q.key, e.target.value)}
                  className="font-mono text-sm bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.2)] rounded-none min-h-[120px] p-4 transition-all"
                  placeholder="Insira os dados..."
                />
              ) : (
                <Input 
                  value={formData[q.key] || ""}
                  onChange={(e) => handleChange(q.key, e.target.value)}
                  className="font-mono text-sm bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary focus-visible:shadow-[0_0_10px_hsl(var(--primary)/0.2)] rounded-none h-12 px-4 transition-all"
                  placeholder="Insira os dados..."
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-border/50 flex justify-end bg-background/30">
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            className="font-mono uppercase tracking-widest rounded-none gap-2 font-bold px-8 h-12 btn-weapon-primary"
          >
            {saveMutation.isPending ? "Sincronizando..." : <><Save className="h-4 w-4" /> Registrar Inteligência</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
