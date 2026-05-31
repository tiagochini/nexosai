import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Video, Plus, Loader2, CheckCircle2, XCircle, Eye,
  FileText, Zap, ChevronRight, ArrowLeft, Sparkles, MessageSquare, Send,
} from "lucide-react";

interface VslItem {
  id: string; title: string; format: string; status: string; totalDuration?: number;
  campaignId?: string; createdAt: string;
  sections?: { id: string; sectionType: string; title: string; orderIndex: number; status: string; script?: string }[];
}

const FORMAT_LABEL: Record<string, string> = {
  vsl: "VSL Clássica", webinar: "Webinar", masterclass: "Masterclass",
  challenge_day: "Challenge Day", long_form_video: "Vídeo Longo",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "text-muted-foreground border-border/50 bg-muted/10",
  generating: "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  approved: "text-success border-success/40 bg-success/10",
  rejected: "text-destructive border-destructive/40 bg-destructive/10",
  published: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
};

export default function VslsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const fromCampaignId = params.get("campaignId");
  const fromCampaign = params.get("from") === "campaign";

  const [creating, setCreating] = useState(fromCampaign || false);
  const [selectedVsl, setSelectedVsl] = useState<VslItem | null>(null);
  const [form, setForm] = useState({ title: "", format: "vsl", productName: "", productPrice: "", targetAudience: "", mainPromise: "", campaignId: fromCampaignId ?? "" });
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState("");
  const queryClient = useQueryClient();

  // Auto-load campaign data for pre-fill when coming from campaign detail
  useEffect(() => {
    if (!fromCampaignId) return;
    customFetch<Response>(`/api/campaigns/${fromCampaignId}`)
      .then((res) => {
        if (!res.ok) return;
        return res.json() as Promise<{ campaign: { title?: string; intakeData?: Record<string, unknown> } }>;
      })
      .then((data) => {
        if (!data?.campaign) return;
        const intake = data.campaign.intakeData ?? {};
        setForm((prev) => ({
          ...prev,
          campaignId: fromCampaignId,
          title: `VSL — ${data.campaign.title ?? ""}`.trim(),
          productName: (intake["product.name"] as string | undefined) ?? "",
          productPrice: (intake["product.price"] as string | undefined) ?? "",
          targetAudience: (intake["campaign.targetAudience"] as string | undefined) ?? "",
          mainPromise: (intake["product.mainPromise"] as string | undefined) ?? "",
        }));
      })
      .catch(() => undefined);
  }, [fromCampaignId]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/vsls"],
    queryFn: () => customFetch<{ vsls: VslItem[] }>("/api/vsls").catch(() => ({ vsls: [] })),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const data = await customFetch<{ vsl: VslItem }>("/api/vsls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, campaignId: form.campaignId || undefined }),
      });
      return data;
    },
    onSuccess: (d) => {
      toast.success("VSL criada! Gerando roteiro com o agente...");
      queryClient.setQueryData(["/api/vsls"], (old: { vsls: VslItem[] } | undefined) => ({
        vsls: [d.vsl, ...(old?.vsls ?? [])],
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/vsls"] });
      setCreating(false);
      setForm({ title: "", format: "vsl", productName: "", productPrice: "", targetAudience: "", mainPromise: "", campaignId: "" });
      setSelectedVsl(d.vsl);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const generateMutation = useMutation({
    mutationFn: async (vslId: string) => {
      await customFetch<{ vsl: VslItem }>(`/api/vsls/${vslId}/generate`, { method: "POST" });
    },
    onSuccess: () => {
      toast.success("Roteiro gerado com o agente!");
      queryClient.invalidateQueries({ queryKey: ["/api/vsls"] });
    },
    onError: () => toast.error("Erro ao gerar roteiro"),
  });

  const refineMutation = useMutation({
    mutationFn: async ({ vslId, instructions }: { vslId: string; instructions: string }) => {
      await customFetch<{ vsl: VslItem }>(`/api/vsls/${vslId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions }),
      });
    },
    onSuccess: () => {
      toast.success("IA refinou o roteiro com suas instruções!");
      setRefineOpen(false);
      setRefineText("");
      queryClient.invalidateQueries({ queryKey: ["/api/vsls"] });
    },
    onError: () => toast.error("Erro ao refinar roteiro"),
  });

  const approveMutation = useMutation({
    mutationFn: async (vslId: string) => {
      await customFetch<{ vsl: VslItem }>(`/api/vsls/${vslId}/approve`, { method: "POST" });
    },
    onSuccess: () => { toast.success("VSL aprovada!"); queryClient.invalidateQueries({ queryKey: ["/api/vsls"] }); },
    onError: () => toast.error("Erro ao aprovar VSL"),
  });

  const vsls = data?.vsls ?? [];

  if (selectedVsl) {
    return (
      <div className="space-y-5 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelectedVsl(null)} className="font-mono uppercase text-xs tracking-widest -ml-2 text-muted-foreground hover:text-foreground">
          ← Voltar para VSLs
        </Button>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/50 pb-4">
          <h1 className="font-mono font-bold text-xl uppercase tracking-wide flex-1">{selectedVsl.title}</h1>
          <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${STATUS_COLOR[selectedVsl.status] ?? ""}`}>{selectedVsl.status}</Badge>
          <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-border/50">{FORMAT_LABEL[selectedVsl.format] ?? selectedVsl.format}</Badge>
          {selectedVsl.status === "draft" && (
            <Button size="sm" onClick={() => generateMutation.mutate(selectedVsl.id)} disabled={generateMutation.isPending}
              className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs">
              {generateMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando...</> : <><Zap className="h-3.5 w-3.5" />Gerar com o agente</>}
            </Button>
          )}
          {selectedVsl.status === "awaiting_approval" && (
            <Button size="sm" onClick={() => approveMutation.mutate(selectedVsl.id)} disabled={approveMutation.isPending}
              className="font-mono uppercase tracking-widest rounded-none gap-2 h-9 px-4 text-xs bg-success/20 text-success border border-success/30">
              <CheckCircle2 className="h-3.5 w-3.5" />Aprovar VSL
            </Button>
          )}
          {(selectedVsl.sections ?? []).length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setRefineOpen(v => !v)}
              className="font-mono uppercase tracking-widest rounded-none gap-2 h-9 px-4 text-xs border-primary/40 text-primary hover:bg-primary/10">
              <Sparkles className="h-3.5 w-3.5" />Refinar com IA
            </Button>
          )}
        </div>

        {/* AI Refine Panel */}
        {refineOpen && (
          <div className="border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Chat com a IA do VSL</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">Descreva como quer que a IA refine ou reescreva o roteiro. Ex: "torne o gancho mais agressivo", "adicione mais prova social na seção de credibilidade", "reduza para 20 minutos mantendo as 6 objeções".</p>
            <div className="flex gap-2">
              <textarea
                value={refineText}
                onChange={e => setRefineText(e.target.value)}
                placeholder="O que você quer que a IA ajuste neste roteiro VSL?"
                rows={3}
                className="flex-1 bg-background border border-border/50 rounded-none px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && refineText.trim()) {
                    refineMutation.mutate({ vslId: selectedVsl.id, instructions: refineText.trim() });
                  }
                }}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-mono text-muted-foreground/50">Ctrl+Enter para enviar · A IA vai regenerar o roteiro completo com suas instruções</p>
              <Button
                size="sm"
                onClick={() => refineMutation.mutate({ vslId: selectedVsl.id, instructions: refineText.trim() })}
                disabled={!refineText.trim() || refineMutation.isPending}
                className="font-mono uppercase tracking-widest rounded-none gap-2 h-8 px-4 text-xs btn-weapon-primary"
              >
                {refineMutation.isPending
                  ? <><Loader2 className="h-3 w-3 animate-spin" />Refinando...</>
                  : <><Send className="h-3 w-3" />Enviar</>}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {(selectedVsl.sections ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Clique em "Gerar com o agente" para criar o roteiro completo</p>
            </div>
          ) : (
            (selectedVsl.sections ?? []).sort((a,b) => a.orderIndex - b.orderIndex).map(section => (
              <div key={section.id} className={`border bg-card/40 p-4 ${section.status === "approved" ? "border-success/30" : "border-border/50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest">#{section.orderIndex + 1}</span>
                  <span className="font-mono text-xs font-bold uppercase tracking-wide">{section.title}</span>
                  <Badge variant="outline" className="rounded-none font-mono text-[11px] px-1.5 py-0.5 border-border/40 text-muted-foreground ml-auto">{section.sectionType}</Badge>
                </div>
                {section.script && (
                  <p className="text-xs font-mono text-foreground/80 leading-relaxed whitespace-pre-wrap mt-2 border-t border-border/30 pt-2">{section.script}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/50 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">VSL Studio</h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Roteiros de video de vendas gerados pelo agente · VSL, Webinar, Masterclass</p>
          {fromCampaign && (
            <p className="text-xs font-mono text-primary mt-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Vinculado à campanha — dados pré-preenchidos automaticamente
            </p>
          )}
        </div>
        <Button onClick={() => setCreating(true)} className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11 px-5">
          <Plus className="h-4 w-4" />Nova VSL
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="border border-primary/30 bg-card/40 p-5 space-y-4 relative">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
          <h2 className="font-mono font-bold text-sm uppercase tracking-widest">Nova VSL</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Título *</label>
              <Input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="VSL Principal do Produto X" className="font-mono text-sm bg-background/50 border-border/50 focus-visible:ring-primary rounded-none h-9" />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Formato</label>
              <select value={form.format} onChange={e => setForm(p => ({...p, format: e.target.value}))}
                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none h-9 px-3 text-foreground">
                {Object.entries(FORMAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Nome do Produto</label>
              <Input value={form.productName} onChange={e => setForm(p => ({...p, productName: e.target.value}))} placeholder="Curso X" className="font-mono text-sm bg-background/50 border-border/50 focus-visible:ring-primary rounded-none h-9" />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Preço</label>
              <Input value={form.productPrice} onChange={e => setForm(p => ({...p, productPrice: e.target.value}))} placeholder="R$ 997" className="font-mono text-sm bg-background/50 border-border/50 focus-visible:ring-primary rounded-none h-9" />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Público-alvo</label>
              <Input value={form.targetAudience} onChange={e => setForm(p => ({...p, targetAudience: e.target.value}))} placeholder="Empreendedores iniciantes" className="font-mono text-sm bg-background/50 border-border/50 focus-visible:ring-primary rounded-none h-9" />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Promessa Principal</label>
              <Input value={form.mainPromise} onChange={e => setForm(p => ({...p, mainPromise: e.target.value}))} placeholder="Faturar R$10k em 30 dias" className="font-mono text-sm bg-background/50 border-border/50 focus-visible:ring-primary rounded-none h-9" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending}
              className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-5 text-xs">
              {createMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Criando...</> : <><Zap className="h-3.5 w-3.5" />Criar VSL</>}
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)} className="font-mono uppercase tracking-widest rounded-none h-10 px-4 text-xs text-muted-foreground">Cancelar</Button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
      ) : vsls.length === 0 ? (
        <div className="py-16 text-center">
          <Video className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Nenhuma VSL criada ainda</p>
          <p className="font-mono text-xs text-muted-foreground/50">Crie sua primeira VSL e deixe o agente gerar o roteiro completo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vsls.map(vsl => (
            <div key={vsl.id} onClick={() => setSelectedVsl(vsl)}
              className="border border-border/50 bg-card/40 p-4 cursor-pointer hover:border-primary/40 hover:bg-card/60 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="w-10 h-10 border border-border/50 bg-card/30 flex items-center justify-center shrink-0">
                  <Video className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors uppercase">{vsl.title}</span>
                    <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${STATUS_COLOR[vsl.status] ?? ""}`}>{vsl.status}</Badge>
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-border/40 text-muted-foreground">{FORMAT_LABEL[vsl.format] ?? vsl.format}</Badge>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                    {new Date(vsl.createdAt).toLocaleDateString("pt-BR")}
                    {vsl.sections && ` · ${vsl.sections.length} seções`}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0 hidden md:block" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
