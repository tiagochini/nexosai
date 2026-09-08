import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, MessageCircle, Target, Globe } from "lucide-react";
import { DomainsTab } from "./components/DomainsTab";
import { TelegramTab } from "./components/TelegramTab";
import { AdsReadinessTab } from "./components/AdsReadinessTab";

export default function InfraestruturaPage() {
  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col gap-2 shrink-0">
        <h1 className="text-2xl font-black font-mono uppercase tracking-widest text-foreground flex items-center gap-3">
          <Server className="h-7 w-7 text-primary" />
          Infraestrutura
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-l-2 border-primary/50 pl-3">
          Gestão profunda de domínios, hosting, robôs de comunidade e conectividade de publicidade.
        </p>
      </div>

      <Tabs defaultValue="domains" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-card/50 border border-border/50 justify-start h-auto p-1.5 overflow-x-auto shrink-0 w-full rounded-sm">
          <TabsTrigger value="domains" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <Globe className="h-3.5 w-3.5" /> Domínios & Hosting
          </TabsTrigger>
          <TabsTrigger value="telegram" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <MessageCircle className="h-3.5 w-3.5" /> Telegram Bot
          </TabsTrigger>
          <TabsTrigger value="ads" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <Target className="h-3.5 w-3.5" /> Prontidão de Ads
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 mt-4 bg-card/10 border border-border/30 rounded-sm p-4 overflow-y-auto relative scanline-overlay">
          <div className="relative z-10 h-full">
            <TabsContent value="domains" className="m-0 h-full"><DomainsTab /></TabsContent>
            <TabsContent value="telegram" className="m-0 h-full"><TelegramTab /></TabsContent>
            <TabsContent value="ads" className="m-0 h-full"><AdsReadinessTab /></TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
