import { useState, useEffect } from "react";
import { useGetWorkspaceIntegrations, useGetTelegramSetup, useCheckTelegramReadiness } from "../hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, ExternalLink, CheckCircle2, Loader2, Link2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export function TelegramTab() {
  const { data: integrations, isLoading: loadingInts } = useGetWorkspaceIntegrations();
  
  const telegramInt = integrations?.find((i: any) => i.provider === "telegram");
  
  const { data: setup, isLoading: loadingSetup, refetch } = useGetTelegramSetup(telegramInt?.id || "");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (telegramInt?.id && !webhookUrl) {
      // Usa a origem atual como base para o webhook
      setWebhookUrl(`${window.location.origin}/api/community/telegram/webhook/${telegramInt.id}`);
    }
  }, [telegramInt?.id, webhookUrl]);

  const checkReadiness = useCheckTelegramReadiness();

  if (loadingInts || (telegramInt && loadingSetup)) {
    return <Skeleton className="h-64 w-full bg-card/40" />;
  }

  if (!telegramInt) {
    return (
      <div className="p-8 border border-dashed border-border/50 text-center bg-card/20 flex flex-col items-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="font-mono text-sm text-foreground">Nenhuma integração Telegram encontrada.</p>
        <p className="font-mono text-xs text-muted-foreground mt-1 mb-4">Adicione o provedor Telegram na página de Integrações primeiro.</p>
        <Button variant="outline" className="btn-weapon-outline rounded-none font-mono text-xs uppercase" asChild>
          <a href="/integracoes">Ir para Integrações</a>
        </Button>
      </div>
    );
  }

  const handleReadiness = () => {
    checkReadiness.mutate({ integrationId: telegramInt.id, webhookUrl }, {
      onSuccess: (data) => {
        if (data.ready) {
          toast.success(`Bot @${data.bot?.username} verificado e webhook configurado!`);
          refetch();
        } else {
          toast.error("Verificação falhou.");
        }
      },
      onError: (err: any) => toast.error(err.message || "Erro ao verificar prontidão."),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-mono font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" /> Telegram Bot & Comunidade
        </h2>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
          Siga os passos abaixo para configurar o bot e conectá-lo ao grupo.
        </p>
      </div>

      <div className="card-weapon p-0">
        <div className="flex items-center justify-between p-4 border-b border-border/40 bg-card/30">
          <div className="font-mono text-xs uppercase tracking-widest text-foreground font-semibold">Status da Integração</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">ID: {telegramInt.id.split("-")[0]}...</div>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Passo 1: BotFather */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 mt-1">
              <div className="h-6 w-6 rounded-full border border-primary text-primary flex items-center justify-center font-mono text-xs font-bold bg-primary/10">1</div>
            </div>
            <div className="space-y-2 flex-1">
              <div className="font-mono text-sm font-bold text-foreground">Criar Bot no BotFather</div>
              <p className="font-mono text-xs text-muted-foreground">
                Acesse o <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center">@BotFather <ExternalLink className="h-3 w-3 ml-1" /></a> no Telegram, use o comando <code className="text-primary">/newbot</code> e siga as instruções.
                Copie o token gerado e configure o secret seguro no gerenciador de variáveis da NexOS.
              </p>
              <div className="p-3 bg-muted/20 border border-border/50 text-[10px] font-mono text-muted-foreground">
                <ShieldAlert className="inline h-3 w-3 mr-1 text-primary" /> Nunca insira o token raw diretamente em campos de texto. Use a referência segura do secret (ex: <code className="text-primary">sec_telegram_bot_token</code>).
              </div>
            </div>
          </div>

          {/* Passos Guiados (do backend) */}
          {setup?.steps.map((step, idx) => (
            <div key={step.id} className="flex gap-4 border-t border-border/20 pt-6">
              <div className="flex-shrink-0 mt-1">
                <div className="h-6 w-6 rounded-full border border-primary/50 text-primary/70 flex items-center justify-center font-mono text-xs bg-card/50">{idx + 2}</div>
              </div>
              <div className="space-y-2 flex-1">
                <div className="font-mono text-sm font-bold text-foreground capitalize">{step.id.replace(/_/g, " ")}</div>
                <p className="font-mono text-xs text-muted-foreground">{step.detail}</p>
                
                {step.id === "configure_webhook" && (
                  <div className="mt-4 space-y-3 max-w-xl">
                    <div className="flex gap-2">
                      <Input 
                        value={webhookUrl} 
                        onChange={(e) => setWebhookUrl(e.target.value)} 
                        className="font-mono text-xs rounded-none h-9 border-border/50 bg-background/50" 
                        placeholder="https://sua-url/webhook" 
                      />
                      <Button 
                        onClick={handleReadiness} 
                        disabled={checkReadiness.isPending} 
                        className="btn-weapon-primary rounded-none font-mono text-xs uppercase h-9 shrink-0"
                      >
                        {checkReadiness.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Link2 className="h-3 w-3 mr-2" />}
                        Verificar & Ligar
                      </Button>
                    </div>
                    {checkReadiness.isSuccess && checkReadiness.data?.ready && (
                      <div className="text-[10px] font-mono text-success uppercase tracking-widest flex items-center">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Bot Verificado e Operacional
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
