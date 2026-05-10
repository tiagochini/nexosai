import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Brain, Trash2, RefreshCw, Sparkles, Clock,
  TrendingUp, ChevronDown, ChevronUp, Info, Filter,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface MemoryEntry {
  id: string;
  agentRole: string;
  memoryType: string;
  contentType?: string;
  title: string;
  summary: string;
  tags?: string[];
  qualityScore?: number;
  isNegative: boolean;
  isPublicReference: boolean;
  productNiche?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
}
interface MemoryStats {
  total: number;
  byType: Record<string, number>;
  byAgent: Record<string, number>;
}

// ── Label maps ─────────────────────────────────────────────────────────────────
const AGENT_LABEL: Record<string, string> = {
  command: "Comandante IA", strategy: "Estrategista", launch_manager: "Gerente de Lançamento",
  offer: "Especialista em Oferta", product_builder: "Product Builder",
  copywriter: "Copywriter", creative_director: "Diretor Criativo",
  landing_page: "Landing Page", targeting: "Targeting Expert",
  media_buyer: "Media Buyer", affiliate_campaign: "Afiliados",
  analytics: "Analista de Performance", optimization: "Otimizador",
  video: "Vídeo", creator_growth: "Creator Growth", compliance: "Compliance",
};
const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  performance_insight:  { label: "Performance",   className: "text-success border-success/40 bg-success/10" },
  strategy_pattern:     { label: "Estratégia",    className: "text-primary border-primary/40 bg-primary/10" },
  audience_insight:     { label: "Audiência",     className: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  content_template:     { label: "Template",      className: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10" },
  market_reference:     { label: "Mercado",       className: "text-purple-400 border-purple-400/40 bg-purple-400/10" },
  compliance_flag:      { label: "Compliance",    className: "text-red-400 border-red-400/40 bg-red-400/10" },
  offer_framework:      { label: "Oferta",        className: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  agent_preference:     { label: "Preferência",   className: "text-muted-foreground border-border bg-muted/20" },
};

function QualityBar({ score }: { score?: number }) {
  if (!score) return null;
  const color = score >= 80 ? "bg-success" : score >= 50 ? "bg-yellow-400" : "bg-destructive";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-muted/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-[8px] text-muted-foreground/50">{score}</span>
    </div>
  );
}

export default function MemoryPage() {
  const qc = useQueryClient();
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/memory/stats"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/memory/stats");
      if (!res.ok) return null;
      return res.json() as Promise<{ stats: MemoryStats }>;
    },
  });

  const { data: memoriesData, isLoading: loadingMemories } = useQuery({
    queryKey: ["/api/memory", filterAgent, filterType],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (filterAgent) params.set("agentRole", filterAgent);
      if (filterType) params.set("type", filterType);
      const res = await customFetch<Response>(`/api/memory?${params}`);
      if (!res.ok) return { memories: [] };
      return res.json() as Promise<{ memories: MemoryEntry[] }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await customFetch<Response>(`/api/memory/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao deletar memória");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Memória removida do cérebro compartilhado");
      void qc.invalidateQueries({ queryKey: ["/api/memory"] });
      void qc.invalidateQueries({ queryKey: ["/api/memory/stats"] });
    },
    onError: () => toast.error("Não foi possível remover esta memória"),
  });

  const stats = statsData?.stats;
  const memories = memoriesData?.memories ?? [];
  const allAgents = Object.keys(stats?.byAgent ?? {});
  const allTypes = Object.keys(stats?.byType ?? {});

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-primary" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Memória de IA
          </h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Conhecimento acumulado pelos agentes ao longo das suas campanhas
        </p>
      </div>

      {/* ── Info banner ── */}
      <div className="border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <p className="font-mono text-[9px] text-muted-foreground/80 leading-relaxed">
          Cada agente armazena aqui o que aprendeu sobre seu negócio, mercado e audiência.
          Quanto mais você usa a plataforma, mais preciso e personalizado fica o output de cada agente.
          Memórias de referência pública não podem ser deletadas.
        </p>
      </div>

      {/* ── Stats ── */}
      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-border/50 bg-card/40 p-3">
            <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">Total</div>
            <div className="font-mono text-2xl font-bold text-primary mt-1">{stats?.total ?? 0}</div>
            <div className="font-mono text-[8px] text-muted-foreground/40">memórias ativas</div>
          </div>
          {Object.entries(stats?.byType ?? {}).slice(0, 3).map(([type, count]) => {
            const badge = TYPE_BADGE[type];
            return (
              <div key={type} className="border border-border/50 bg-card/40 p-3">
                <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">{badge?.label ?? type}</div>
                <div className={`font-mono text-2xl font-bold mt-1 ${badge?.className.split(" ")[0] ?? "text-primary"}`}>{count as number}</div>
                <div className="font-mono text-[8px] text-muted-foreground/40">entradas</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-3 w-3 text-muted-foreground/40" />
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="font-mono text-[10px] uppercase tracking-widest bg-card/40 border border-border/50 px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary/50 rounded-none"
        >
          <option value="">Todos os agentes</option>
          {allAgents.map(role => (
            <option key={role} value={role}>{AGENT_LABEL[role] ?? role}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="font-mono text-[10px] uppercase tracking-widest bg-card/40 border border-border/50 px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary/50 rounded-none"
        >
          <option value="">Todos os tipos</option>
          {allTypes.map(t => (
            <option key={t} value={t}>{TYPE_BADGE[t]?.label ?? t}</option>
          ))}
        </select>
        {(filterAgent || filterType) && (
          <button
            onClick={() => { setFilterAgent(""); setFilterType(""); }}
            className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 hover:text-primary flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="h-2.5 w-2.5" />Limpar
          </button>
        )}
        <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">{memories.length} {memories.length === 1 ? "entrada" : "entradas"}</span>
      </div>

      {/* ── Memory list ── */}
      {loadingMemories ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 bg-muted/20" />)}
        </div>
      ) : memories.length === 0 ? (
        <div className="border border-border/30 bg-muted/10 p-10 text-center">
          <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            {filterAgent || filterType ? "Nenhuma memória com esses filtros" : "Nenhuma memória armazenada ainda"}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground/30 mt-1">
            Execute campanhas com os agentes para acumular memória contextual
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {memories.map(mem => {
            const badge = TYPE_BADGE[mem.memoryType];
            const agentLabel = AGENT_LABEL[mem.agentRole] ?? mem.agentRole;
            const isExpanded = expanded === mem.id;
            return (
              <div key={mem.id} className={`border bg-card/40 transition-all ${mem.isNegative ? "border-destructive/20" : "border-border/50"}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/10"
                  onClick={() => setExpanded(isExpanded ? null : mem.id)}
                >
                  {/* Type badge */}
                  {badge && (
                    <Badge variant="outline" className={`rounded-none font-mono text-[7px] px-1.5 py-0.5 shrink-0 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  )}

                  {/* Title + agent */}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-bold truncate text-foreground">{mem.title}</div>
                    <div className="font-mono text-[8px] text-muted-foreground/50 uppercase tracking-widest">
                      {agentLabel}
                      {mem.productNiche && ` · ${mem.productNiche}`}
                    </div>
                  </div>

                  {/* Right: quality + usage + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <QualityBar score={mem.qualityScore ?? undefined} />
                    {mem.usageCount > 0 && (
                      <span className="font-mono text-[8px] text-muted-foreground/40 hidden sm:block">
                        {mem.usageCount}× usado
                      </span>
                    )}
                    {!mem.isPublicReference && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(mem.id);
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1 hover:text-destructive text-muted-foreground/30 transition-colors"
                        title="Remover memória"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    {mem.isPublicReference && (
                      <Sparkles className="h-3 w-3 text-primary/30" aria-label="Referência pública" />
                    )}
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border/30 px-4 py-3 bg-muted/5 space-y-2">
                    <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">{mem.summary}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(mem.tags ?? []).map(tag => (
                        <span key={tag} className="font-mono text-[7px] border border-border/40 bg-muted/20 px-1.5 py-0.5 text-muted-foreground/60 uppercase tracking-widest">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 pt-1">
                      <span className="font-mono text-[8px] text-muted-foreground/40 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(mem.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      {mem.lastUsedAt && (
                        <span className="font-mono text-[8px] text-muted-foreground/40 flex items-center gap-1">
                          <TrendingUp className="h-2.5 w-2.5" />
                          Último uso: {new Date(mem.lastUsedAt).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {mem.isNegative && (
                        <Badge variant="outline" className="rounded-none font-mono text-[7px] text-destructive border-destructive/30 bg-destructive/10">
                          Aprendizado Negativo
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
