import { useState, useEffect, useRef, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Radar, Plus, RefreshCw, Trash2, ArrowLeft, Send, Sparkles,
  Target, TrendingUp, AlertTriangle, CheckCircle2, Sword, Shield,
  DollarSign, Share2, Zap, MessageSquare, X, Loader2, HelpCircle,
} from "lucide-react";

const API = "/api/market-intel";

interface Competitor {
  name: string;
  estimatedRevenue?: string;
  marketShare?: string;
  positioningAngle?: string;
  strengthsPerceived?: string[];
  weaknessesExposed?: string[];
  pricingStrategy?: string;
  trafficSources?: string[];
  contentStrategy?: string;
  biggestVulnerability?: string;
  reverseEngineeredStrategy?: string;
}
interface PositioningGap {
  gap: string;
  opportunity?: string;
  entryBarrier?: string;
  estimatedTAM?: string;
}
interface MarketIntelOutput {
  market?: string;
  marketSize?: string;
  marketMaturity?: string;
  totalAdressableAudience?: string;
  competitors?: Competitor[];
  positioningGaps?: PositioningGap[];
  winningStrategyVsField?: string;
  untappedSegments?: string[];
  keywordBattlefield?: string;
  contentArbitrage?: string;
  pricingArbitrage?: string;
  platformArbitrage?: string;
  entryRecommendation?: string;
  firstMoverActions?: string[];
  clarifyingQuestions?: string[];
}
interface CampaignLite { id: string; title: string; status: string }

const MATURITY_LABEL: Record<string, string> = {
  emerging: "Emergente",
  growing: "Em crescimento",
  mature: "Maduro",
  saturated: "Saturado",
  declining: "Em declínio",
};
const SHARE_LABEL: Record<string, string> = {
  dominant: "Dominante",
  major: "Grande player",
  significant: "Relevante",
  minor: "Pequeno",
  niche: "Nicho",
};

const RUNNING_PHASES = [
  "Mapeando o campo de batalha do mercado",
  "Fazendo engenharia reversa dos concorrentes",
  "Identificando gaps de posicionamento",
  "Encontrando arbitragens de conteúdo, preço e plataforma",
  "Definindo a estratégia de entrada mais defensável",
];
const PHASE_SECONDS = 25;
interface Report {
  id: string;
  campaignId: string | null;
  productName: string;
  market: string;
  status: "running" | "ready" | "failed";
  output: MarketIntelOutput | null;
  error: string | null;
  source: string;
  createdAt: string;
}
interface ChatMsg { role: "user" | "assistant"; content: string }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  running: { label: "Analisando…", cls: "text-amber-400 border-amber-400/30 bg-amber-400/8" },
  ready:   { label: "Pronto",      cls: "text-green-400 border-green-400/30 bg-green-400/8" },
  failed:  { label: "Falhou",      cls: "text-destructive border-destructive/30 bg-destructive/8" },
};

export default function MarketIntelPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // new analysis form
  const [productName, setProductName] = useState("");
  const [market, setMarket] = useState("");
  const [category, setCategory] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [positioning, setPositioning] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [platforms, setPlatforms] = useState("");
  const [audience, setAudience] = useState("");

  // campaign linking
  const [campaigns, setCampaigns] = useState<CampaignLite[] | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // phased loading
  const [phaseIdx, setPhaseIdx] = useState(0);

  // chat
  const [showChat, setShowChat] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const loadReports = useCallback(async () => {
    try {
      const data = await customFetch<{ reports: Report[] }>(API);
      setReports(data.reports);
      return data.reports;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  // Poll while any report is running (or the selected one is)
  useEffect(() => {
    const anyRunning = reports.some((r) => r.status === "running");
    if (!anyRunning) return;
    const t = setInterval(async () => {
      const fresh = await loadReports();
      if (selected) {
        const updated = fresh.find((r) => r.id === selected.id);
        if (updated && updated.status !== selected.status) setSelected(updated);
      }
    }, 8000);
    return () => clearInterval(t);
  }, [reports, selected, loadReports]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  // Track phases while the selected report is running
  useEffect(() => {
    if (selected?.status !== "running") {
      setPhaseIdx(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setPhaseIdx(Math.min(Math.floor(elapsed / PHASE_SECONDS), RUNNING_PHASES.length - 1));
    }, 2000);
    return () => clearInterval(t);
  }, [selected?.id, selected?.status]);

  async function loadCampaigns(): Promise<CampaignLite[]> {
    if (campaigns) return campaigns;
    try {
      const data = await customFetch<{ campaigns: CampaignLite[] }>("/api/campaigns");
      setCampaigns(data.campaigns);
      return data.campaigns;
    } catch {
      setCampaigns([]);
      return [];
    }
  }

  async function linkToCampaign(campaignId: string) {
    if (!selected || linking) return;
    setLinking(true);
    setLinkError(null);
    try {
      const data = await customFetch<{ report: Report }>(`${API}/${selected.id}/link-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      setSelected(data.report);
      setShowLink(false);
      await loadReports();
    } catch {
      setLinkError("Não foi possível vincular. Tente novamente.");
    } finally {
      setLinking(false);
    }
  }

  async function createAnalysis() {
    if (!productName.trim() || market.trim().length < 3) {
      setFormError("Informe pelo menos o nome do produto e a descrição do mercado.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const body = {
        productName: productName.trim(),
        market: market.trim(),
        productCategory: category.trim() || undefined,
        knownCompetitors: competitors.trim()
          ? competitors.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 10)
          : undefined,
        currentPositioning: positioning.trim() || undefined,
        priceRange: priceRange.trim() || undefined,
        platforms: platforms.trim()
          ? platforms.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 10)
          : undefined,
        targetAudience: audience.trim() || undefined,
      };
      const data = await customFetch<{ report: Report }>(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowNew(false);
      setProductName(""); setMarket(""); setCategory(""); setCompetitors("");
      setPositioning(""); setPriceRange(""); setPlatforms(""); setAudience("");
      await loadReports();
      setSelected(data.report);
    } catch {
      setFormError("Não foi possível iniciar a análise. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  async function removeReport(id: string) {
    try {
      await customFetch(`${API}/${id}`, { method: "DELETE" });
      if (selected?.id === id) setSelected(null);
      await loadReports();
    } catch { /* noop */ }
  }

  async function openReport(r: Report) {
    setShowChat(false);
    setChatMsgs([]);
    setShowLink(false);
    setLinkError(null);
    try {
      const data = await customFetch<{ report: Report }>(`${API}/${r.id}`);
      setSelected(data.report);
    } catch {
      setSelected(r);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || !selected || chatSending) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMsgs((m) => [...m, { role: "user", content: question }]);
    setChatSending(true);
    try {
      const data = await customFetch<{ answer: string }>(`${API}/${selected.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          // Truncate each history message to avoid hitting the server payload limit
          history: chatMsgs.slice(-10).map((m) => ({
            ...m,
            content: m.content.slice(0, 30000),
          })),
        }),
      });
      setChatMsgs((m) => [...m, { role: "assistant", content: data.answer }]);
    } catch (err: unknown) {
      const serverMsg = (err as { data?: { error?: string } } | null)?.data?.error;
      const fallback = "Não consegui responder agora. Tente novamente em instantes.";
      setChatMsgs((m) => [...m, { role: "assistant", content: serverMsg ?? fallback }]);
    } finally {
      setChatSending(false);
    }
  }

  // ── Report detail view ─────────────────────────────────────────────────────
  if (selected) {
    const out = selected.output;
    const meta = STATUS_META[selected.status] ?? STATUS_META.running!;
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-mono text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                <Radar className="h-5 w-5 text-primary" /> {selected.productName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{selected.market}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
            {selected.source === "intake" && (
              <Badge variant="outline" className="text-primary border-primary/30">Gerado no Briefing</Badge>
            )}
            {selected.campaignId && (
              <Badge variant="outline" className="text-green-400 border-green-400/30">Vinculado a campanha</Badge>
            )}
            {selected.status === "ready" && !selected.campaignId && (
              <Button variant="outline" size="sm" onClick={() => { setShowLink((v) => !v); loadCampaigns(); }}>
                <Target className="h-4 w-4 mr-1.5" /> Usar nesta campanha
              </Button>
            )}
            {selected.status === "ready" && (
              <Button size="sm" onClick={() => setShowChat((v) => !v)}>
                <MessageSquare className="h-4 w-4 mr-1.5" /> Deepdive
              </Button>
            )}
          </div>
        </div>

        {showLink && selected.status === "ready" && !selected.campaignId && (
          <div className="border border-primary/30 bg-primary/[0.03] rounded-sm p-4 space-y-3">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Vincular esta análise a uma campanha — o Time de Estratégia passa a usá-la no briefing e no plano
            </p>
            {campaigns === null ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando campanhas…
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma campanha ainda. Crie uma campanha primeiro.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {campaigns.map((c) => (
                  <Button key={c.id} variant="outline" size="sm" disabled={linking}
                    onClick={() => linkToCampaign(c.id)}>
                    {linking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    {c.title}
                  </Button>
                ))}
              </div>
            )}
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
          </div>
        )}

        {selected.status === "running" && (
          <div className="border border-amber-400/30 bg-amber-400/5 rounded-sm p-8 space-y-5">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin mx-auto" />
              <p className="font-mono text-sm text-amber-400 uppercase tracking-wider">Time de Inteligência em campo</p>
              <p className="text-xs text-muted-foreground">A análise completa leva 1–3 minutos.</p>
            </div>
            <div className="max-w-md mx-auto space-y-2.5">
              {RUNNING_PHASES.map((phase, i) => (
                <div key={phase} className={`flex items-center gap-2.5 text-sm ${
                  i < phaseIdx ? "text-green-400" : i === phaseIdx ? "text-foreground" : "text-muted-foreground/50"
                }`}>
                  {i < phaseIdx ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  ) : i === phaseIdx ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full border border-border/60" />
                  )}
                  <span>{phase}{i === phaseIdx ? "…" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selected.status === "failed" && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-sm p-6 space-y-2">
            <p className="font-mono text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> A análise falhou
            </p>
            <p className="text-xs text-muted-foreground">{selected.error ?? "Erro desconhecido."}</p>
          </div>
        )}

        {out && selected.status === "ready" && (
          <div className={`grid gap-6 ${showChat ? "lg:grid-cols-[1fr_380px]" : ""}`}>
            <div className="space-y-6 min-w-0">
              {/* Overview */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Tamanho do Mercado", value: out.marketSize, icon: TrendingUp },
                  { label: "Maturidade", value: out.marketMaturity ? (MATURITY_LABEL[out.marketMaturity] ?? out.marketMaturity) : undefined, icon: Target },
                  { label: "Audiência Endereçável", value: out.totalAdressableAudience, icon: Shield },
                ].filter((s) => s.value).map(({ label, value, icon: Icon }) => (
                  <div key={label} className="border border-border/50 rounded-sm p-4 bg-card/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
                    </div>
                    <p className="text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {/* Clarifying questions */}
              {(out.clarifyingQuestions?.length ?? 0) > 0 && (
                <div className="border border-amber-400/30 bg-amber-400/5 rounded-sm p-5 space-y-3">
                  <h2 className="font-mono text-sm uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" /> Perguntas que refinariam esta análise
                  </h2>
                  <ul className="space-y-2">
                    {out.clarifyingQuestions!.map((q, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-amber-400 font-mono">{i + 1}.</span> {q}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Responda no chat Deepdive ou durante o briefing da campanha — a análise fica mais cirúrgica.</p>
                </div>
              )}

              {/* Competitors */}
              <div className="space-y-3">
                <h2 className="font-mono text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Sword className="h-4 w-4 text-primary" /> Concorrentes ({out.competitors?.length ?? 0})
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {(out.competitors ?? []).map((c, i) => (
                    <div key={i} className="border border-border/50 rounded-sm p-4 bg-card/50 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm">{c.name}</span>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {c.marketShare && (
                            <Badge variant="outline" className="text-[10px]">{SHARE_LABEL[c.marketShare] ?? c.marketShare}</Badge>
                          )}
                          {c.estimatedRevenue && (
                            <span className="text-[10px] font-mono text-muted-foreground">{c.estimatedRevenue}</span>
                          )}
                        </div>
                      </div>
                      {c.positioningAngle && <p className="text-xs text-muted-foreground">{c.positioningAngle}</p>}
                      {c.pricingStrategy && (
                        <p className="text-xs text-muted-foreground"><span className="text-foreground/70">Preço:</span> {c.pricingStrategy}</p>
                      )}
                      {(c.strengthsPerceived?.length || c.weaknessesExposed?.length) ? (
                        <div className="grid grid-cols-2 gap-3">
                          {(c.strengthsPerceived?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wider text-green-400 mb-1">Fortes</p>
                              <ul className="space-y-0.5">
                                {c.strengthsPerceived!.slice(0, 3).map((s, j) => (
                                  <li key={j} className="text-xs text-muted-foreground">• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(c.weaknessesExposed?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-1">Fracos</p>
                              <ul className="space-y-0.5">
                                {c.weaknessesExposed!.slice(0, 3).map((w, j) => (
                                  <li key={j} className="text-xs text-muted-foreground">• {w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : null}
                      {c.reverseEngineeredStrategy && (
                        <p className="text-xs text-muted-foreground"><span className="text-foreground/70">Estratégia real:</span> {c.reverseEngineeredStrategy}</p>
                      )}
                      {c.biggestVulnerability && (
                        <div className="border-l-2 border-destructive/60 pl-3">
                          <p className="text-[11px] font-mono uppercase tracking-wider text-destructive mb-0.5">Vulnerabilidade explorável</p>
                          <p className="text-xs">{c.biggestVulnerability}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Positioning gaps */}
              <div className="space-y-3">
                <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Gaps de Posicionamento
                </h2>
                {(out.positioningGaps ?? []).map((g, i) => (
                  <div key={i} className="border border-primary/20 rounded-sm p-4 bg-primary/[0.03] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{g.gap}</p>
                      {g.estimatedTAM && <Badge variant="outline" className="text-[10px] shrink-0">{g.estimatedTAM}</Badge>}
                    </div>
                    {g.opportunity && (
                      <p className="text-xs text-muted-foreground"><span className="text-primary">Por que é vencedor:</span> {g.opportunity}</p>
                    )}
                    {g.entryBarrier && (
                      <p className="text-xs text-muted-foreground"><span className="text-foreground/70">Barreira de entrada:</span> {g.entryBarrier}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Winning strategy */}
              {out.winningStrategyVsField && (
                <div className="border border-border/50 rounded-sm p-5 bg-card/50 space-y-2">
                  <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                    <Sword className="h-4 w-4 text-primary" /> Como vencer este campo
                  </h2>
                  <p className="text-sm text-muted-foreground">{out.winningStrategyVsField}</p>
                </div>
              )}

              {/* Arbitrage */}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: "Segmentos não atendidos", value: out.untappedSegments?.length ? out.untappedSegments.join(" • ") : undefined, icon: Target },
                  { label: "Campo de batalha de palavras-chave", value: out.keywordBattlefield, icon: Sword },
                  { label: "Arbitragem de conteúdo", value: out.contentArbitrage, icon: Sparkles },
                  { label: "Arbitragem de preço", value: out.pricingArbitrage, icon: DollarSign },
                  { label: "Arbitragem de plataforma", value: out.platformArbitrage, icon: Share2 },
                ].filter((s) => s.value).map(({ label, value, icon: Icon }) => (
                  <div key={label} className="border border-border/50 rounded-sm p-4 bg-card/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
                    </div>
                    <p className="text-xs">{value}</p>
                  </div>
                ))}
              </div>

              {/* Entry recommendation */}
              <div className="border border-green-400/30 bg-green-400/5 rounded-sm p-5 space-y-3">
                <h2 className="font-mono text-sm uppercase tracking-wider text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Entrada Recomendada
                </h2>
                <p className="text-sm">{out.entryRecommendation}</p>
                {(out.firstMoverActions?.length ?? 0) > 0 && (
                  <div className="pt-2 border-t border-green-400/15 space-y-1.5">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-green-400" /> Ações first-mover — faça AGORA
                    </p>
                    {out.firstMoverActions!.map((a, i) => (
                      <p key={i} className="text-xs flex gap-2"><span className="text-green-400 font-mono">{i + 1}.</span> {a}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Deepdive chat */}
            {showChat && (
              <div className="border border-border/50 rounded-sm bg-card/50 flex flex-col h-[calc(100vh-220px)] sticky top-6 min-w-0">
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Deepdive com o Analista
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setShowChat(false)} aria-label="Fechar chat">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMsgs.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">
                      Pergunte qualquer coisa sobre este mercado: "Como ataco a vulnerabilidade do concorrente X?", "Qual gap priorizo com orçamento baixo?"…
                    </p>
                  )}
                  {chatMsgs.map((m, i) => (
                    <div key={i} className={`text-sm p-3 rounded-sm max-w-[92%] whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary/15 text-foreground ml-auto"
                        : "bg-muted/40 text-foreground/90"
                    }`}>
                      {m.content}
                    </div>
                  ))}
                  {chatSending && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando…
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <div className="p-3 border-t border-border/50 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder="Pergunte ao analista…"
                    className="flex-1 bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  />
                  <Button size="sm" onClick={sendChat} disabled={chatSending || !chatInput.trim()} aria-label="Enviar">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono text-xl font-bold uppercase tracking-wider flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary" /> Inteligência de Mercado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise mercadológica completa: concorrentes, gaps de posicionamento e arbitragens — antes de investir 1 real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadReports()} aria-label="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova Análise
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="border border-primary/30 rounded-sm bg-card/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Nova Análise de Mercado
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} aria-label="Fechar formulário">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Produto *</label>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex: Mentoria de Tráfego Pago"
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Categoria / Nicho</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: marketing digital, emagrecimento…"
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Descreva o mercado *</label>
            <textarea value={market} onChange={(e) => setMarket(e.target.value)} rows={4}
              maxLength={10000}
              placeholder="O que você vende, para quem, e em qual contexto de mercado. Quanto mais detalhe, mais cirúrgica a análise."
              className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Concorrentes conhecidos (vírgula)</label>
              <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="Ex: Fulano, Empresa X…"
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Faixa de preço</label>
              <input value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder="Ex: R$997 – R$2.997"
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Posicionamento atual</label>
              <input value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="Como você se apresenta hoje"
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Público-alvo</label>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Quem compra de você"
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Plataformas onde você atua (vírgula)</label>
            <input value={platforms} onChange={(e) => setPlatforms(e.target.value)} placeholder="Ex: Instagram, YouTube, TikTok…"
              className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <Button onClick={createAnalysis} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Radar className="h-4 w-4 mr-1.5" />}
            Iniciar Análise
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 && !showNew ? (
        <div className="border border-border/50 rounded-sm p-12 text-center space-y-3 bg-card/30">
          <Radar className="h-10 w-10 text-primary/40 mx-auto" />
          <p className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Nenhuma análise ainda</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Rode uma análise agora — ou inicie o briefing de uma campanha: o Time de Inteligência dispara a análise automaticamente durante a conversa.
          </p>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Primeira Análise
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.running!;
            return (
              <div key={r.id}
                className="border border-border/50 rounded-sm p-4 bg-card/40 hover:bg-card/70 hover:border-primary/30 transition-all cursor-pointer flex items-center gap-4"
                onClick={() => openReport(r)}
              >
                <Radar className={`h-5 w-5 shrink-0 ${r.status === "running" ? "text-amber-400 animate-pulse" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.productName}</span>
                    <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                    {r.source === "intake" && (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Briefing</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.market}</p>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                  {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </span>
                <Button variant="ghost" size="sm" aria-label="Excluir análise"
                  onClick={(e) => { e.stopPropagation(); removeReport(r.id); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
