import { useState, useEffect, useRef, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Radar, Plus, RefreshCw, Trash2, ArrowLeft, Send, Sparkles,
  Target, TrendingUp, AlertTriangle, CheckCircle2, Sword, Shield,
  DollarSign, Share2, Zap, MessageSquare, X, Loader2, HelpCircle, MapPin, Database
} from "lucide-react";
import { RegionalIntelDashboard } from "./regional-intel-dashboard";
import { useGetCampaigns } from "@/hooks/use-regional-intel";
import { Link } from "wouter";
import { CapacityTab } from "./capacity-tab";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

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

const RUNNING_PHASES = [
  ["Mapeando o campo de batalha do mercado", "Mapping the market battlefield", "Mapeando el campo de batalla del mercado"],
  ["Fazendo engenharia reversa dos concorrentes", "Reverse-engineering competitors", "Analizando a la competencia"],
  ["Identificando gaps de posicionamento", "Identifying positioning gaps", "Identificando brechas de posicionamiento"],
  ["Encontrando arbitragens de conteúdo, preço e plataforma", "Finding content, pricing, and platform arbitrage", "Buscando oportunidades en contenido, precios y plataformas"],
  ["Definindo a estratégia de entrada mais defensável", "Defining the most defensible entry strategy", "Definiendo la estrategia de entrada más sólida"],
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
interface ChatMsg { role: "user" | "assistant"; content: string; ts?: string }

const STATUS_META: Record<string, { cls: string }> = {
  running: { cls: "text-amber-400 border-amber-400/30 bg-amber-400/8" },
  ready:   { cls: "text-green-400 border-green-400/30 bg-green-400/8" },
  failed:  { cls: "text-destructive border-destructive/30 bg-destructive/8" },
};

export default function MarketIntelPage() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const dateLocale = intlLocale(locale);
  const statusLabel = (status: string) => status === "running" ? t("Analisando…", "Analyzing…", "Analizando…") : status === "ready" ? t("Pronto", "Ready", "Listo") : t("Falhou", "Failed", "Fallido");
  const maturityLabel = (value: string) => {
    const labels: Record<string, [string, string, string]> = {
      emerging: ["Emergente", "Emerging", "Emergente"], growing: ["Em crescimento", "Growing", "En crecimiento"],
      mature: ["Maduro", "Mature", "Maduro"], saturated: ["Saturado", "Saturated", "Saturado"], declining: ["Em declínio", "Declining", "En declive"],
    };
    return labels[value] ? t(...labels[value]!) : value;
  };
  const shareLabel = (value: string) => {
    const labels: Record<string, [string, string, string]> = {
      dominant: ["Dominante", "Dominant", "Dominante"], major: ["Grande player", "Major player", "Actor principal"],
      significant: ["Relevante", "Significant", "Relevante"], minor: ["Pequeno", "Minor", "Pequeño"], niche: ["Nicho", "Niche", "Nicho"],
    };
    return labels[value] ? t(...labels[value]!) : value;
  };
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // new analysis form
  const [selectedProductId, setSelectedProductId] = useState("");
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
  const [chatLoadingHistory, setChatLoadingHistory] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [activeMainTab, setActiveMainTab] = useState("reports");
  const [selectedRegionalCampaignId, setSelectedRegionalCampaignId] = useState<string | null>(null);
  const { data: campaignsData } = useGetCampaigns();

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
      setLinkError(t("Não foi possível vincular. Tente novamente.", "Could not link. Please try again.", "No se pudo vincular. Inténtalo de nuevo."));
    } finally {
      setLinking(false);
    }
  }

  async function createAnalysis() {
    if (!productName.trim() || market.trim().length < 3) {
      setFormError(t("Informe pelo menos o nome do produto e a descrição do mercado.", "Enter at least the product name and market description.", "Indica al menos el nombre del producto y la descripción del mercado."));
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
      setFormError(t("Não foi possível iniciar a análise. Tente novamente.", "Could not start the analysis. Please try again.", "No se pudo iniciar el análisis. Inténtalo de nuevo."));
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
    // Restore persisted chat history
    try {
      setChatLoadingHistory(true);
      const histData = await customFetch<{ history: ChatMsg[] }>(`${API}/${r.id}/chat`);
      if (histData.history.length > 0) {
        setChatMsgs(histData.history);
        setShowChat(true); // auto-open chat if there's saved history
      }
    } catch { /* noop — treat as empty history */ } finally {
      setChatLoadingHistory(false);
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
      const fallback = t("Não consegui responder agora. Tente novamente em instantes.", "I couldn't respond just now. Please try again shortly.", "No pude responder ahora. Inténtalo de nuevo en un momento.");
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
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label={t("Voltar", "Back", "Volver")}>
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
              <Badge variant="outline" className={meta.cls}>{statusLabel(selected.status)}</Badge>
            {selected.source === "intake" && (
              <Badge variant="outline" className="text-primary border-primary/30">{t("Gerado no Briefing", "Generated from Briefing", "Generado desde el briefing")}</Badge>
            )}
            {selected.campaignId && (
              <Badge variant="outline" className="text-green-400 border-green-400/30">{t("Vinculado a campanha", "Linked to campaign", "Vinculado a la campaña")}</Badge>
            )}
            {selected.status === "ready" && !selected.campaignId && (
              <Button variant="outline" size="sm" onClick={() => { setShowLink((v) => !v); loadCampaigns(); }}>
                <Target className="h-4 w-4 mr-1.5" /> {t("Usar nesta campanha", "Use in this campaign", "Usar en esta campaña")}
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
              {t("Vincular esta análise a uma campanha — o Time de Estratégia passa a usá-la no briefing e no plano", "Link this analysis to a campaign — the Strategy Team will use it in the brief and plan", "Vincula este análisis a una campaña: el equipo de estrategia lo usará en el briefing y el plan")}
            </p>
            {campaigns === null ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Carregando campanhas…", "Loading campaigns…", "Cargando campañas…")}
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("Nenhuma campanha ainda. Crie uma campanha primeiro.", "No campaigns yet. Create a campaign first.", "Aún no hay campañas. Crea una primero.")}</p>
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
              <p className="font-mono text-sm text-amber-400 uppercase tracking-wider">{t("Time de Inteligência em campo", "Intelligence team at work", "Equipo de inteligencia en acción")}</p>
              <p className="text-xs text-muted-foreground">{t("A análise completa leva 1–3 minutos.", "The full analysis takes 1–3 minutes.", "El análisis completo tarda entre 1 y 3 minutos.")}</p>
            </div>
            <div className="max-w-md mx-auto space-y-2.5">
              {RUNNING_PHASES.map((phase, i) => (
                <div key={i} className={`flex items-center gap-2.5 text-sm ${
                  i < phaseIdx ? "text-green-400" : i === phaseIdx ? "text-foreground" : "text-muted-foreground/50"
                }`}>
                  {i < phaseIdx ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  ) : i === phaseIdx ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full border border-border/60" />
                  )}
                  <span>{t(...phase as [string, string, string])}{i === phaseIdx ? "…" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selected.status === "failed" && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-sm p-6 space-y-2">
            <p className="font-mono text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {t("A análise falhou", "Analysis failed", "El análisis falló")}
            </p>
            <p className="text-xs text-muted-foreground">{selected.error ?? t("Erro desconhecido.", "Unknown error.", "Error desconocido.")}</p>
          </div>
        )}

        {out && selected.status === "ready" && (
          <div className={`grid gap-6 ${showChat ? "lg:grid-cols-[1fr_380px]" : ""}`}>
            <div className="space-y-6 min-w-0">
              {/* Overview */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: t("Tamanho do Mercado", "Market Size", "Tamaño del mercado"), value: out.marketSize, icon: TrendingUp },
                  { label: t("Maturidade", "Maturity", "Madurez"), value: out.marketMaturity ? maturityLabel(out.marketMaturity) : undefined, icon: Target },
                  { label: t("Audiência Endereçável", "Addressable Audience", "Audiencia potencial"), value: out.totalAdressableAudience, icon: Shield },
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
                    <HelpCircle className="h-4 w-4" /> {t("Perguntas que refinariam esta análise", "Questions that would refine this analysis", "Preguntas que ayudarían a refinar este análisis")}
                  </h2>
                  <ul className="space-y-2">
                    {out.clarifyingQuestions!.map((q, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-amber-400 font-mono">{i + 1}.</span> {q}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">{t("Responda no chat Deepdive ou durante o briefing da campanha — a análise fica mais cirúrgica.", "Answer in the Deepdive chat or during the campaign briefing to make the analysis more precise.", "Responde en el chat Deepdive o durante el briefing de campaña para afinar el análisis.")}</p>
                </div>
              )}

              {/* Competitors */}
              <div className="space-y-3">
                <h2 className="font-mono text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Sword className="h-4 w-4 text-primary" /> {t("Concorrentes", "Competitors", "Competidores")} ({out.competitors?.length ?? 0})
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {(out.competitors ?? []).map((c, i) => (
                    <div key={i} className="border border-border/50 rounded-sm p-4 bg-card/50 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm">{c.name}</span>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {c.marketShare && (
                            <Badge variant="outline" className="text-[10px]">{shareLabel(c.marketShare)}</Badge>
                          )}
                          {c.estimatedRevenue && (
                            <span className="text-[10px] font-mono text-muted-foreground">{c.estimatedRevenue}</span>
                          )}
                        </div>
                      </div>
                      {c.positioningAngle && <p className="text-xs text-muted-foreground">{c.positioningAngle}</p>}
                      {c.pricingStrategy && (
                        <p className="text-xs text-muted-foreground"><span className="text-foreground/70">{t("Preço:", "Pricing:", "Precio:")}</span> {c.pricingStrategy}</p>
                      )}
                      {(c.strengthsPerceived?.length || c.weaknessesExposed?.length) ? (
                        <div className="grid grid-cols-2 gap-3">
                          {(c.strengthsPerceived?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wider text-green-400 mb-1">{t("Fortes", "Strengths", "Fortalezas")}</p>
                              <ul className="space-y-0.5">
                                {c.strengthsPerceived!.slice(0, 3).map((s, j) => (
                                  <li key={j} className="text-xs text-muted-foreground">• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(c.weaknessesExposed?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-1">{t("Fracos", "Weaknesses", "Debilidades")}</p>
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
                        <p className="text-xs text-muted-foreground"><span className="text-foreground/70">{t("Estratégia real:", "Actual strategy:", "Estrategia real:")}</span> {c.reverseEngineeredStrategy}</p>
                      )}
                      {c.biggestVulnerability && (
                        <div className="border-l-2 border-destructive/60 pl-3">
                          <p className="text-[11px] font-mono uppercase tracking-wider text-destructive mb-0.5">{t("Vulnerabilidade explorável", "Exploitable vulnerability", "Vulnerabilidad explotable")}</p>
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
                  <Target className="h-4 w-4 text-primary" /> {t("Gaps de Posicionamento", "Positioning Gaps", "Brechas de posicionamiento")}
                </h2>
                {(out.positioningGaps ?? []).map((g, i) => (
                  <div key={i} className="border border-primary/20 rounded-sm p-4 bg-primary/[0.03] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{g.gap}</p>
                      {g.estimatedTAM && <Badge variant="outline" className="text-[10px] shrink-0">{g.estimatedTAM}</Badge>}
                    </div>
                    {g.opportunity && (
                      <p className="text-xs text-muted-foreground"><span className="text-primary">{t("Por que é vencedor:", "Why it wins:", "Por qué es una ventaja:")}</span> {g.opportunity}</p>
                    )}
                    {g.entryBarrier && (
                      <p className="text-xs text-muted-foreground"><span className="text-foreground/70">{t("Barreira de entrada:", "Entry barrier:", "Barrera de entrada:")}</span> {g.entryBarrier}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Winning strategy */}
              {out.winningStrategyVsField && (
                <div className="border border-border/50 rounded-sm p-5 bg-card/50 space-y-2">
                  <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                    <Sword className="h-4 w-4 text-primary" /> {t("Como vencer este campo", "How to win in this market", "Cómo ganar en este mercado")}
                  </h2>
                  <p className="text-sm text-muted-foreground">{out.winningStrategyVsField}</p>
                </div>
              )}

              {/* Arbitrage */}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: t("Segmentos não atendidos", "Underserved Segments", "Segmentos desatendidos"), value: out.untappedSegments?.length ? out.untappedSegments.join(" • ") : undefined, icon: Target },
                  { label: t("Campo de batalha de palavras-chave", "Keyword Battlefield", "Campo de batalla de palabras clave"), value: out.keywordBattlefield, icon: Sword },
                  { label: t("Arbitragem de conteúdo", "Content Arbitrage", "Oportunidad en contenido"), value: out.contentArbitrage, icon: Sparkles },
                  { label: t("Arbitragem de preço", "Pricing Arbitrage", "Oportunidad en precios"), value: out.pricingArbitrage, icon: DollarSign },
                  { label: t("Arbitragem de plataforma", "Platform Arbitrage", "Oportunidad en plataformas"), value: out.platformArbitrage, icon: Share2 },
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
                  <CheckCircle2 className="h-4 w-4" /> {t("Entrada Recomendada", "Recommended Entry", "Entrada recomendada")}
                </h2>
                <p className="text-sm">{out.entryRecommendation}</p>
                {(out.firstMoverActions?.length ?? 0) > 0 && (
                  <div className="pt-2 border-t border-green-400/15 space-y-1.5">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-green-400" /> {t("Ações first-mover — faça AGORA", "First-mover actions — do NOW", "Acciones pioneras — hazlas AHORA")}
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
                  <div className="flex items-center gap-2">
                    {chatMsgs.length > 0 && (
                      <span className="text-[10px] text-green-400/70 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400/70" />
                         {t("salvo", "saved", "guardado")}
                      </span>
                    )}
                    {chatLoadingHistory && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setShowChat(false)} aria-label={t("Fechar chat", "Close chat", "Cerrar chat")}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMsgs.length === 0 && !chatLoadingHistory && (
                    <p className="text-xs text-muted-foreground p-2">
                      {t('Pergunte qualquer coisa sobre este mercado: "Como ataco a vulnerabilidade do concorrente X?", "Qual gap priorizo com orçamento baixo?"…', 'Ask anything about this market: "How do I target competitor X’s vulnerability?", "Which gap should I prioritize on a small budget?"…', 'Pregunta lo que quieras sobre este mercado: "¿Cómo aprovecho la vulnerabilidad del competidor X?", "¿Qué brecha priorizo con poco presupuesto?"…')}<br/>
                      <span className="mt-1 block text-[10px] text-muted-foreground/60">{t("Conversa salva automaticamente e compartilhada com os agentes de Social Media e Lançamentos.", "Conversation saved automatically and shared with the Social Media and Launch agents.", "La conversación se guarda automáticamente y se comparte con los agentes de redes sociales y lanzamientos.")}</span>
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Analisando…", "Analyzing…", "Analizando…")}
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <div className="p-3 border-t border-border/50 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder={t("Pergunte ao analista…", "Ask the analyst…", "Pregunta al analista…")}
                    className="flex-1 bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  />
                  <Button size="sm" onClick={sendChat} disabled={chatSending || !chatInput.trim()} aria-label={t("Enviar", "Send", "Enviar")}>
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
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="mb-6 bg-background border border-border/50">
          <TabsTrigger value="reports" className="data-[state=active]:bg-card/50">{t("Análises de Mercado", "Market Analyses", "Análisis de mercado")}</TabsTrigger>
          <TabsTrigger value="regional" className="data-[state=active]:bg-card/50">{t("Radar Regional", "Regional Radar", "Radar regional")}</TabsTrigger>
          <TabsTrigger value="capacity" className="data-[state=active]:bg-card/50">{t("Radar de Mercado", "Market Radar", "Radar de mercado")}</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6 mt-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-mono text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                <Radar className="h-5 w-5 text-primary" /> {t("Inteligência de Mercado", "Market Intelligence", "Inteligencia de mercado")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("Análise mercadológica completa: concorrentes, gaps de posicionamento e arbitragens — antes de investir 1 real.", "Complete market analysis: competitors, positioning gaps, and arbitrage opportunities — before investing a dollar.", "Análisis completo del mercado: competidores, brechas de posicionamiento y oportunidades, antes de invertir.")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => loadReports()} aria-label={t("Atualizar", "Refresh", "Actualizar")}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button asChild variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
                <Link href="/intake?entryPoint=market_intel">
                  <Database className="h-4 w-4 mr-1.5" /> {t("Briefing Central", "Central Briefing", "Briefing central")}
                </Link>
              </Button>
              <Button size="sm" onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> {t("Nova Análise Avulsa", "New Standalone Analysis", "Nuevo análisis independiente")}
              </Button>
            </div>
          </div>

          {showNew && (
            <div className="border border-primary/30 rounded-sm bg-card/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> {t("Nova Análise de Mercado", "New Market Analysis", "Nuevo análisis de mercado")}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} aria-label={t("Fechar formulário", "Close form", "Cerrar formulario")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Produto *", "Product *", "Producto *")}</label>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t("Ex: Mentoria de Tráfego Pago", "E.g., Paid Traffic Coaching", "Ej.: Asesoría de tráfico pago")}
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Categoria / Nicho", "Category / Niche", "Categoría / nicho")}</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("Ex: marketing digital, emagrecimento…", "E.g., digital marketing, weight loss…", "Ej.: marketing digital, pérdida de peso…")}
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Descreva o mercado *", "Describe the market *", "Describe el mercado *")}</label>
            <textarea value={market} onChange={(e) => setMarket(e.target.value)} rows={4}
              maxLength={10000}
              placeholder={t("O que você vende, para quem, e em qual contexto de mercado. Quanto mais detalhe, mais cirúrgica a análise.", "What you sell, who you sell to, and the market context. More detail leads to a more precise analysis.", "Qué vendes, a quién y en qué contexto de mercado. Cuantos más detalles, más preciso será el análisis.")}
              className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Concorrentes conhecidos (vírgula)", "Known competitors (comma-separated)", "Competidores conocidos (separados por comas)")}</label>
              <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder={t("Ex: Fulano, Empresa X…", "E.g., Acme, Company X…", "Ej.: Acme, Empresa X…")}
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Faixa de preço", "Price range", "Rango de precios")}</label>
              <input value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder={t("Ex: R$997 – R$2.997", "E.g., $97 – $297", "Ej.: $97 – $297")}
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Posicionamento atual", "Current positioning", "Posicionamiento actual")}</label>
              <input value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder={t("Como você se apresenta hoje", "How you currently present yourself", "Cómo te presentas actualmente")}
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Público-alvo", "Target audience", "Público objetivo")}</label>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={t("Quem compra de você", "Who buys from you", "Quién te compra")}
                className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("Plataformas onde você atua (vírgula)", "Platforms where you operate (comma-separated)", "Plataformas donde tienes presencia (separadas por comas)")}</label>
            <input value={platforms} onChange={(e) => setPlatforms(e.target.value)} placeholder={t("Ex: Instagram, YouTube, TikTok…", "E.g., Instagram, YouTube, TikTok…", "Ej.: Instagram, YouTube, TikTok…")}
              className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <Button onClick={createAnalysis} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Radar className="h-4 w-4 mr-1.5" />}
            {t("Iniciar Análise", "Start Analysis", "Iniciar análisis")}
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
          <p className="font-mono text-sm uppercase tracking-wider text-muted-foreground">{t("Nenhuma análise ainda", "No analyses yet", "Aún no hay análisis")}</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {t("Rode uma análise agora — ou inicie o briefing de uma campanha: o Time de Inteligência dispara a análise automaticamente durante a conversa.", "Run an analysis now — or start a campaign briefing: the Intelligence Team launches the analysis automatically during the conversation.", "Ejecuta un análisis ahora o inicia el briefing de una campaña: el equipo de inteligencia lo iniciará automáticamente durante la conversación.")}
          </p>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> {t("Primeira Análise", "First Analysis", "Primer análisis")}
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
                    <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{statusLabel(r.status)}</Badge>
                    {r.source === "intake" && (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">{t("Briefing", "Briefing", "Briefing")}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.market}</p>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                  {new Date(r.createdAt).toLocaleDateString(dateLocale)}
                </span>
                <Button variant="ghost" size="sm" aria-label={t("Excluir análise", "Delete analysis", "Eliminar análisis")}
                  onClick={(e) => { e.stopPropagation(); removeReport(r.id); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="regional" className="space-y-6 mt-0">
          {!selectedRegionalCampaignId ? (
            <div className="border border-border/50 rounded-sm p-12 text-center space-y-4 bg-card/30">
              <MapPin className="h-10 w-10 mx-auto text-primary/50" />
              <h2 className="font-mono text-lg uppercase tracking-wider">{t("Radar de Audiência", "Audience Radar", "Radar de audiencia")}</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {t("Selecione uma campanha para monitorar dados regionais, extrair evidências, rastrear sinais sociais e encontrar oportunidades prontas para ativação.", "Select a campaign to monitor regional data, gather evidence, track social signals, and find opportunities ready for activation.", "Selecciona una campaña para supervisar datos regionales, recopilar evidencia, seguir señales sociales y encontrar oportunidades listas para activarse.")}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                {campaignsData?.campaigns === undefined ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("Carregando campanhas...", "Loading campaigns...", "Cargando campañas...")}
                  </div>
                ) : campaignsData.campaigns.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("Nenhuma campanha encontrada.", "No campaigns found.", "No se encontraron campañas.")}</p>
                ) : (
                  campaignsData.campaigns.map(c => (
                    <Button
                      key={c.id}
                      variant="outline"
                      onClick={() => setSelectedRegionalCampaignId(c.id)}
                    >
                      {c.title}
                    </Button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedRegionalCampaignId(null)}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("Voltar", "Back", "Volver")}
                </Button>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t("Campanha Selecionada", "Selected Campaign", "Campaña seleccionada")}</p>
                  <p className="text-sm font-medium">{campaignsData?.campaigns.find(c => c.id === selectedRegionalCampaignId)?.title || t("Campanha", "Campaign", "Campaña")}</p>
                </div>
              </div>

              <RegionalIntelDashboard campaignId={selectedRegionalCampaignId} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="capacity" className="mt-0">
          <CapacityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
