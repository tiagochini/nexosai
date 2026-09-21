import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsTab } from "./components/AccountsTab";
import { PoliciesTab } from "./components/PoliciesTab";
import { ProposalsTab } from "./components/ProposalsTab";
import { AttemptsTab } from "./components/AttemptsTab";
import { LaunchPlansTab } from "./components/LaunchPlansTab";
import { ShieldAlert, Activity, GitCommit, FileText, Target, Rocket } from "lucide-react";

export default function PaidMediaPage() {
  return (
    <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto w-full p-4 md:p-6">
      <div className="flex flex-col gap-2 shrink-0">
        <h1 className="text-2xl font-black font-mono uppercase tracking-widest text-foreground flex items-center gap-3">
          <Target className="h-7 w-7 text-primary" />
          Operações Autônomas (Mídia)
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-l-2 border-primary/50 pl-3">
          Centro de controle algorítmico, simulações preventivas e execução via interface profunda para Meta Ads, TikTok Ads e Google Ads.
        </p>
      </div>

      <Tabs defaultValue="launch-plans" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-card/50 border border-border/50 justify-start h-auto p-1.5 overflow-x-auto shrink-0 w-full rounded-sm">
          <TabsTrigger value="launch-plans" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <Rocket className="h-3.5 w-3.5" /> Lançamentos (Master Plan)
          </TabsTrigger>
          <TabsTrigger value="accounts" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <Activity className="h-3.5 w-3.5" /> Integrações & Sync
          </TabsTrigger>
          <TabsTrigger value="policies" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <ShieldAlert className="h-3.5 w-3.5" /> Políticas
          </TabsTrigger>
          <TabsTrigger value="proposals" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <FileText className="h-3.5 w-3.5" /> Otimização
          </TabsTrigger>
          <TabsTrigger value="attempts" className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/30">
            <GitCommit className="h-3.5 w-3.5" /> Audit
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 mt-4 bg-card/10 border border-border/30 rounded-sm p-4 overflow-y-auto relative scanline-overlay">
          <div className="relative z-10 h-full">
            <TabsContent value="launch-plans" className="m-0 h-full"><LaunchPlansTab /></TabsContent>
            <TabsContent value="accounts" className="m-0 h-full"><AccountsTab /></TabsContent>
            <TabsContent value="policies" className="m-0 h-full"><PoliciesTab /></TabsContent>
            <TabsContent value="proposals" className="m-0 h-full"><ProposalsTab /></TabsContent>
            <TabsContent value="attempts" className="m-0 h-full"><AttemptsTab /></TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
