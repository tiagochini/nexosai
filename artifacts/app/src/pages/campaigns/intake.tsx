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
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
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
        toast.success("Dados salvos com sucesso.");
        queryClient.invalidateQueries({ queryKey: getGetIntakeQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetIntakeScoreQueryKey(campaignId) });
      },
      onError: () => {
        toast.error("Falha ao salvar dados.");
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
      <div className="space-y-8 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const completeness = data?.completeness || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <Link href={`/campaigns/${campaignId}`}>
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Detalhes da Missão
            </Button>
          </Link>
          <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Intake Estratégico</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Forneça o máximo de dados para a inteligência artificial</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Progresso: {completeness}%</div>
          <Progress value={completeness} className="w-32 h-2 rounded-none bg-muted [&>div]:bg-primary" />
          {scoreData && (
            <div className="font-mono text-[10px] uppercase font-bold text-primary mt-1 border border-primary/20 px-2 py-1 bg-primary/10">
              Score: {scoreData.score} - {scoreData.label}
            </div>
          )}
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs uppercase tracking-wider">
            <AlertCircle className="h-4 w-4 text-primary" />
            Salvamos seu progresso progressivamente. Suas respostas definem a qualidade da copy.
          </div>
        </div>

        <div className="p-8 space-y-8">
          {data?.questions?.map((q) => (
            <div key={q.key} className="space-y-2">
              <Label className="font-mono text-sm uppercase tracking-wider text-foreground">
                {q.label} {q.required && <span className="text-destructive">*</span>}
              </Label>
              {q.type === 'textarea' ? (
                <Textarea 
                  value={formData[q.key] || ""}
                  onChange={(e) => handleChange(q.key, e.target.value)}
                  className="font-mono text-sm bg-background border-border rounded-none min-h-[100px]"
                />
              ) : (
                <Input 
                  value={formData[q.key] || ""}
                  onChange={(e) => handleChange(q.key, e.target.value)}
                  className="font-mono text-sm bg-background border-border rounded-none"
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-border flex justify-end bg-muted/30">
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            className="font-mono uppercase tracking-wider rounded-none gap-2 font-bold"
          >
            {saveMutation.isPending ? "Sincronizando..." : <><Save className="h-4 w-4" /> Salvar Progresso</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
