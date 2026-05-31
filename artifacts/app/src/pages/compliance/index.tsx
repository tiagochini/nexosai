import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Loader2,
  BarChart3, Zap,
} from "lucide-react";

interface ComplianceCheck {
  id: string; contentTitle: string; contentType: string; platform: string; status: string;
  riskLevel?: string; violations?: string[]; suggestions?: string[];
  overallScore?: number; createdAt: string;
}
interface ComplianceStats {
  total: number; passed: number; failed: number; pending: number; avgScore?: number;
}

const RISK_COLOR: Record<string, string> = {
  low: "text-success border-success/40 bg-success/10",
  medium: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  high: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  critical: "text-destructive border-destructive/40 bg-destructive/10",
};
const STATUS_COLOR: Record<string, string> = {
  approved: "text-success border-success/40 bg-success/10",
  rejected: "text-destructive border-destructive/40 bg-destructive/10",
  pending: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  flagged: "text-orange-400 border-orange-400/40 bg-orange-400/10",
};
const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: "Meta Ads", google_ads: "Google Ads", tiktok: "TikTok",
  conar: "CONAR", cvm: "CVM", anvisa: "ANVISA", generic: "Geral",
};

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<"checks" | "stats" | "new">("checks");
  const [checkForm, setCheckForm] = useState({ contentTitle: "", contentType: "ad", contentText: "", platform: "meta_ads" as string });
  const queryClient = useQueryClient();

  const { data: statsData } = useQuery({
    queryKey: ["/api/compliance/stats"],
    queryFn: async () => {
      return customFetch<ComplianceStats>("/api/compliance/stats").catch(() => null);
    },
  });

  const { data: checksData, isLoading: checksLoading } = useQuery({
    queryKey: ["/api/compliance/checks"],
    enabled: activeTab === "checks",
    queryFn: async () => {
      return customFetch<{ checks: ComplianceCheck[] }>("/api/compliance/checks?limit=20")
        .catch(() => ({ checks: [] as ComplianceCheck[] }));
    },
  });

  const runCheckMutation = useMutation({
    mutationFn: async () => {
      return customFetch<{ check: ComplianceCheck }>("/api/compliance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkForm),
      });
    },
    onSuccess: () => {
      toast.success("Verificação de compliance concluída.");
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/stats"] });
      setActiveTab("checks");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Compliance</h1>
        </div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Verificação automática de conformidade legal · CONAR · Meta Ads Policy · LGPD · CVM
        </p>
      </div>

      {/* Stats bar */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Checks", value: String(statsData.total), icon: Shield, color: "text-primary border-primary/20 bg-primary/5" },
            { label: "Aprovados", value: String(statsData.passed), icon: CheckCircle2, color: "text-success border-success/20 bg-success/5" },
            { label: "Reprovados", value: String(statsData.failed), icon: XCircle, color: "text-destructive border-destructive/20 bg-destructive/5" },
            { label: "Score Médio", value: statsData.avgScore ? `${statsData.avgScore}/100` : "—", icon: BarChart3, color: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5" },
          ].map(kpi => (
            <div key={kpi.label} className={`border p-4 ${kpi.color}`}>
              <div className="flex items-center gap-2 mb-2"><kpi.icon className="h-3.5 w-3.5" /><span className="text-[11px] font-mono uppercase tracking-widest opacity-70">{kpi.label}</span></div>
              <div className="font-mono font-bold text-xl">{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border border-border/50 bg-card/40 p-1 rounded-sm w-fit">
        {[{ id: "checks" as const, label: "Histórico" }, { id: "new" as const, label: "Nova Verificação" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-all rounded-sm
              ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── New check form ── */}
      {activeTab === "new" && (
        <div className="border border-primary/30 bg-card/40 p-5 space-y-4">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary hidden" />
          <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-primary">Analisar Conteúdo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Título do Conteúdo *</label>
              <input value={checkForm.contentTitle} onChange={e => setCheckForm(p => ({...p, contentTitle: e.target.value}))}
                placeholder="VSL Principal · Anúncio Top Funil..."
                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none h-9 px-3 text-foreground placeholder:text-muted-foreground/50" />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Tipo</label>
              <select value={checkForm.contentType} onChange={e => setCheckForm(p => ({...p, contentType: e.target.value}))}
                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none h-9 px-3 text-foreground">
                <option value="ad">Anúncio</option>
                <option value="copy">Copy de Venda</option>
                <option value="email">Email</option>
                <option value="social_post">Post Social</option>
                <option value="landing_page">Landing Page</option>
                <option value="vsl_script">Roteiro VSL</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Plataforma</label>
              <select value={checkForm.platform} onChange={e => setCheckForm(p => ({...p, platform: e.target.value}))}
                className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none h-9 px-3 text-foreground">
                {Object.entries(PLATFORM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Conteúdo a Verificar *</label>
            <textarea value={checkForm.contentText} onChange={e => setCheckForm(p => ({...p, contentText: e.target.value}))}
              placeholder="Cole o texto do anúncio, copy ou script que deseja verificar..."
              rows={5}
              className="w-full font-mono text-sm bg-background/50 border border-border/50 focus:border-primary/50 focus:outline-none rounded-none px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 resize-y" />
          </div>
          <Button onClick={() => runCheckMutation.mutate()} disabled={!checkForm.contentTitle || !checkForm.contentText || runCheckMutation.isPending}
            className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11 px-5">
            {runCheckMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Analisando com o agente...</> : <><Zap className="h-4 w-4" />Verificar Compliance</>}
          </Button>
        </div>
      )}

      {/* ── Checks history ── */}
      {activeTab === "checks" && (
        <div className="space-y-3">
          {checksLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
          ) : (checksData?.checks ?? []).length === 0 ? (
            <div className="py-16 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Nenhuma verificação realizada</p>
              <Button size="sm" onClick={() => setActiveTab("new")} className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs mt-2">
                <Zap className="h-3.5 w-3.5" />Verificar Primeiro Conteúdo
              </Button>
            </div>
          ) : (
            (checksData?.checks ?? []).map(check => (
              <div key={check.id} className={`border bg-card/40 p-4 ${check.status === "approved" ? "border-success/30" : check.status === "rejected" ? "border-destructive/30" : "border-border/50"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {check.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> :
                   check.status === "rejected" ? <XCircle className="h-4 w-4 text-destructive shrink-0" /> :
                   <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />}
                  <span className="font-mono font-bold text-sm uppercase tracking-wide">{check.contentTitle}</span>
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${STATUS_COLOR[check.status] ?? ""}`}>{check.status}</Badge>
                  {check.riskLevel && <Badge variant="outline" className={`rounded-none font-mono text-[11px] px-2 py-0.5 ${RISK_COLOR[check.riskLevel] ?? ""}`}>{check.riskLevel}</Badge>}
                  <Badge variant="outline" className="rounded-none font-mono text-[11px] px-2 py-0.5 border-border/40 text-muted-foreground ml-auto">{PLATFORM_LABEL[check.platform] ?? check.platform}</Badge>
                </div>
                {check.overallScore !== undefined && (
                  <div className="text-xs font-mono text-muted-foreground mb-2">Score: <span className={check.overallScore >= 70 ? "text-success" : check.overallScore >= 40 ? "text-yellow-400" : "text-destructive"}>{check.overallScore}/100</span></div>
                )}
                {(check.violations ?? []).length > 0 && (
                  <div className="space-y-1 mb-2">
                    {check.violations!.slice(0, 3).map((v, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono text-destructive/80">
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0" />{v}
                      </div>
                    ))}
                  </div>
                )}
                {(check.suggestions ?? []).length > 0 && (
                  <div className="space-y-1">
                    {check.suggestions!.slice(0, 2).map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono text-primary/80">
                        <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />{s}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[11px] font-mono text-muted-foreground/40 mt-2 uppercase tracking-widest">{new Date(check.createdAt).toLocaleString("pt-BR")}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
