import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, DollarSign, Users, AlertTriangle, TrendingUp, Zap, Calendar,
  Brain, ShieldCheck, CheckCircle2, Clock, BarChart3, MessageSquare,
  Sparkles, ArrowRight, Info, ChevronRight,
} from "lucide-react";

// ── Credit pricing ─────────────────────────────────────────────────────────────
const CREDIT_PRICE_BRL = 0.15;

function creditsToReal(credits: number): string {
  return (credits * CREDIT_PRICE_BRL).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function safeParseJSON(val: unknown): Record<string, unknown> | unknown[] | null {
  if (!val) return null;
  if (typeof val === "object") return val as Record<string, unknown>;
  if (typeof val === "string") {
    try {
      const clean = val.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }
  return null;
}

function safeStr(val: unknown, fallback = ""): string {
  if (!val) return fallback;
  if (typeof val === "string") return val;
  return fallback;
}

function safeArr(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  return [];
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, badge, color = "primary", children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  color?: "primary" | "cyan" | "yellow" | "green" | "red";
  children: React.ReactNode;
}) {
  const colors = {
    primary: "text-primary border-primary/20",
    cyan: "text-cyan-400 border-cyan-400/20",
    yellow: "text-yellow-400 border-yellow-400/20",
    green: "text-green-400 border-green-400/20",
    red: "text-red-400 border-red-400/20",
  };
  return (
    <div className={`border ${colors[color]} bg-card/30 p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${colors[color].split(" ")[0]}`} />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
        </div>
        {badge && (
          <Badge variant="outline" className={`font-mono text-[10px] px-2 rounded-none ${colors[color]}`}>
            {badge}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  if (!text) return <p className="text-xs font-mono text-muted-foreground italic">Não disponível</p>;
  return <p className="text-sm font-mono text-foreground/90 leading-relaxed">{text}</p>;
}

function BulletList({ items, icon: Icon, color = "primary" }: {
  items: string[];
  icon?: React.ElementType;
  color?: string;
}) {
  if (!items.length) return <p className="text-xs font-mono text-muted-foreground italic">Nenhum item</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          {Icon ? (
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
          )}
          <span className="text-xs font-mono text-foreground/80 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Credit investment block ────────────────────────────────────────────────────
function InvestmentBlock({
  campaignType, creditEstimate,
}: {
  campaignType: string;
  creditEstimate: { min: number; typical: number; max: number; label: string } | null;
}) {
  const est = creditEstimate ?? { min: 290, typical: 420, max: 630, label: campaignType };

  const breakdown = [
    { phase: "Estratégia", description: "Command + Profile + Strategy + Offer + Manager + Financeiro", credits: 45 },
    { phase: "Conteúdo", description: "16 agentes de IA (copy, landing, ads, compliance, scripts)", credits: 150 },
    { phase: "Sequência", description: "Builder + 15 itens personalizados por segmento", credits: 37 },
    { phase: "Monitoramento", description: "WhatsApp AI responses + ciclos de otimização", credits: est.typical - 232 },
  ];

  return (
    <div className="space-y-4">
      {/* Cost summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Mínimo", credits: est.min, sub: "sem tráfego pago" },
          { label: "Típico", credits: est.typical, sub: "lançamento normal", highlight: true },
          { label: "Máximo", credits: est.max, sub: "com tráfego intenso" },
        ].map(({ label, credits, sub, highlight }) => (
          <div key={label} className={`border p-3 text-center ${highlight ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card/40"}`}>
            <div className={`font-mono text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
              {credits} cr
            </div>
            <div className={`font-mono text-sm ${highlight ? "text-primary/70" : "text-muted-foreground"}`}>
              {creditsToReal(credits)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
            <div className="font-mono text-[9px] text-muted-foreground/60">{sub}</div>
          </div>
        ))}
      </div>

      {/* Phase breakdown */}
      <div className="border border-border/40 bg-card/20">
        <div className="px-4 py-2 border-b border-border/40 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Breakdown por fase
        </div>
        <div className="divide-y divide-border/20">
          {breakdown.map(({ phase, description, credits }) => (
            <div key={phase} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="font-mono text-xs text-foreground">{phase}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{description}</div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="font-mono text-sm font-bold text-primary">{credits} cr</div>
                <div className="font-mono text-[10px] text-muted-foreground">{creditsToReal(credits)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-primary/30 bg-primary/5">
          <div className="font-mono text-xs uppercase tracking-widest text-primary">Total típico</div>
          <div className="text-right">
            <span className="font-mono text-lg font-bold text-primary">{est.typical} créditos</span>
            <span className="font-mono text-sm text-primary/70 ml-2">≈ {creditsToReal(est.typical)}</span>
          </div>
        </div>
      </div>

      {/* Pricing note */}
      <div className="flex items-start gap-2 p-3 border border-border/30 bg-muted/10">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          Créditos são consumidos à medida que os agentes executam. Taxa: R$0,15/crédito para compras avulsas.
          Planos mensais incluem créditos com desconto de ~33%. Créditos não utilizados acumulam até o próximo ciclo.
        </p>
      </div>
    </div>
  );
}

// ── Mental triggers display ────────────────────────────────────────────────────
const TRIGGER_LABELS: Record<string, { label: string; color: string }> = {
  authority: { label: "Autoridade", color: "border-blue-400/40 text-blue-400" },
  social_proof: { label: "Prova Social", color: "border-green-400/40 text-green-400" },
  reciprocity: { label: "Reciprocidade", color: "border-cyan-400/40 text-cyan-400" },
  community: { label: "Comunidade", color: "border-purple-400/40 text-purple-400" },
  scarcity: { label: "Escassez", color: "border-red-400/40 text-red-400" },
  urgency: { label: "Urgência", color: "border-orange-400/40 text-orange-400" },
  anticipation: { label: "Antecipação", color: "border-yellow-400/40 text-yellow-400" },
  event: { label: "Evento", color: "border-pink-400/40 text-pink-400" },
  transformation: { label: "Transformação", color: "border-emerald-400/40 text-emerald-400" },
  fear_of_loss: { label: "Medo de Perder", color: "border-red-400/40 text-red-400" },
  curiosity: { label: "Curiosidade", color: "border-violet-400/40 text-violet-400" },
  contrast: { label: "Contraste", color: "border-amber-400/40 text-amber-400" },
};

// ── Main component ────────────────────────────────────────────────────────────
export interface CampaignBriefProps {
  campaign: {
    id: string;
    title: string;
    type?: string | null;
    track?: string | null;
    status: string;
    revenueTarget?: string | null;
    strategyData?: unknown;
    offerData?: unknown;
    audienceData?: unknown;
    targetingData?: unknown;
    timelineData?: unknown;
  };
  creditEstimate?: { min: number; typical: number; max: number; label: string } | null;
  onApprove?: () => void;
  approveLoading?: boolean;
  showApproveButton?: boolean;
}

export function CampaignBrief({
  campaign, creditEstimate, onApprove, approveLoading, showApproveButton,
}: CampaignBriefProps) {
  const strategyD = useMemo(() => (safeParseJSON(campaign.strategyData) ?? {}) as Record<string, unknown>, [campaign.strategyData]);
  const offerD = useMemo(() => (safeParseJSON(campaign.offerData) ?? {}) as Record<string, unknown>, [campaign.offerData]);
  const audienceD = useMemo(() => (safeParseJSON(campaign.audienceData) ?? {}) as Record<string, unknown>, [campaign.audienceData]);
  const targetingD = useMemo(() => (safeParseJSON(campaign.targetingData) ?? {}) as Record<string, unknown>, [campaign.targetingData]);

  // timelineData may have launchNarrative as a JSON string
  const timelineRaw = useMemo(() => (safeParseJSON(campaign.timelineData) ?? {}) as Record<string, unknown>, [campaign.timelineData]);
  const timelineD = useMemo(() => {
    const parsed = safeParseJSON(timelineRaw["launchNarrative"]) as Record<string, unknown> | null;
    return parsed ?? timelineRaw;
  }, [timelineRaw]);

  // Financial projection: projectorNotes is often a JSON string
  const financialD = useMemo(() => {
    const fp = (offerD["financialProjection"] ?? {}) as Record<string, unknown>;
    const notes = safeParseJSON(fp["projectorNotes"]) as Record<string, unknown> | null;
    return notes ?? fp;
  }, [offerD]);

  // Extract key data
  const executiveSummary = safeStr(strategyD["executiveSummary"]);
  const marketDiagnosis = (strategyD["marketDiagnosis"] ?? {}) as Record<string, unknown>;
  const offerPositioning = (strategyD["offerPositioning"] ?? {}) as Record<string, unknown>;
  const campaignArchitecture = (strategyD["campaignArchitecture"] ?? {}) as Record<string, unknown>;
  const audienceSegmentation = (strategyD["audienceSegmentation"] ?? {}) as Record<string, unknown>;
  const risks = (strategyD["risks"] ?? {}) as Record<string, unknown>;
  const successMetrics = (strategyD["successMetrics"] ?? {}) as Record<string, unknown>;

  const primaryAvatar = (audienceD["primaryAvatar"] ?? {}) as Record<string, unknown>;
  const segments = safeArr(audienceD["segments"] as unknown);
  const criticalInsights = safeArr(audienceD["criticalInsights"] as unknown);

  const positioning = (targetingD["positioning"] ?? {}) as Record<string, unknown>;
  const marketIntelligence = (targetingD["marketIntelligence"] ?? {}) as Record<string, unknown>;

  const phases = (timelineD["phases"] ?? timelineRaw["phases"] ?? []) as unknown[];
  const totalDays = (timelineD["totalDays"] ?? timelineRaw["totalDays"] ?? 0) as number;
  const conversionDays = (timelineD["conversionWindowDays"] ?? timelineRaw["conversionWindowDays"] ?? 7) as number;
  const launchTitle = safeStr(timelineD["launchTitle"] ?? timelineRaw["launchTitle"] as unknown);
  const launchNarrative = safeStr(timelineD["launchNarrative"] ?? timelineRaw["launchNarrative"] as unknown);
  const scarcityMechanism = safeStr(timelineD["scarcityMechanism"] ?? timelineRaw["scarcityMechanism"] as unknown);

  const keyMessages = safeArr(campaignArchitecture["keyMessages"] as unknown);
  const coreNarrative = safeStr(campaignArchitecture["coreNarrative"] as unknown);
  const mentalTriggers = safeArr(campaignArchitecture["mentalTriggers"] as unknown);

  const objections = safeArr(audienceSegmentation["objections"] as unknown);
  const mainRisks = safeArr(risks["mainRisks"] as unknown);
  const riskLevel = safeStr(risks["level"] as unknown);
  const threats = safeArr(marketDiagnosis["threats"] as unknown);
  const entryBarriers = safeArr(marketDiagnosis["entryBarriers"] as unknown);

  const revenueTarget = successMetrics["revenueTarget"]
    ? Number(successMetrics["revenueTarget"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })
    : campaign.revenueTarget
      ? Number(campaign.revenueTarget).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })
      : null;

  const criticalAssumptions = safeArr(successMetrics["criticalAssumptions"] as unknown);
  const riskAlerts = safeArr((financialD["riskAlerts"] ?? []) as unknown);
  const campaignSummary = (financialD["campaignSummary"] ?? {}) as Record<string, unknown>;
  const scenarios = ((financialD["scenarios"] ?? []) as unknown[]).slice(0, 3) as Record<string, unknown>[];
  const keyMetrics = (financialD["keyMetrics"] ?? {}) as Record<string, unknown>;

  const hasStrategy = Object.keys(strategyD).length > 0;

  if (!hasStrategy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Brain className="h-10 w-10 text-muted-foreground/30" />
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest text-center">
          Estratégia ainda não gerada.<br />Execute a fase de análise para gerar a proposta completa.
        </p>
        {showApproveButton && onApprove && (
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Button
              className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-9 px-4 text-xs"
              onClick={onApprove}
              disabled={approveLoading}
            >
              {approveLoading
                ? <><ArrowRight className="h-3 w-3 animate-spin" />Gerando...</>
                : <><Zap className="h-3 w-3" />Gerar Conteúdo Agora</>}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Doc header ── */}
      <div className="border border-primary/30 bg-primary/5 p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary/70 mb-1">
          Proposta de Campanha · NexOS AI · Confidencial
        </div>
        <h2 className="font-mono text-lg font-bold text-foreground uppercase tracking-tight">
          {launchTitle || campaign.title}
        </h2>
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>Tipo: <span className="text-foreground">{campaign.type}</span></span>
          <span>Track: <span className="text-foreground">{campaign.track}</span></span>
          {totalDays > 0 && <span>Duração: <span className="text-foreground">{totalDays} dias</span></span>}
          {conversionDays > 0 && <span>Carrinho aberto: <span className="text-foreground">{conversionDays} dias</span></span>}
          {revenueTarget && <span>Meta: <span className="text-green-400 font-bold">{revenueTarget}</span></span>}
        </div>
      </div>

      {/* ── 1. Executive Summary ── */}
      {executiveSummary && (
        <Section icon={Sparkles} title="Resumo Executivo" color="primary">
          <TextBlock text={executiveSummary} />
        </Section>
      )}

      {/* ── 2. Investment ── */}
      <Section icon={DollarSign} title="Investimento em IA" badge="Créditos + BRL" color="cyan">
        <InvestmentBlock campaignType={campaign.type ?? "launch"} creditEstimate={creditEstimate ?? null} />
      </Section>

      {/* ── 3. Core Narrative & Key Messages ── */}
      {(coreNarrative || keyMessages.length > 0) && (
        <Section icon={MessageSquare} title="Narrativa Central da Campanha" color="primary">
          {coreNarrative && <TextBlock text={coreNarrative} />}
          {keyMessages.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Mensagens-chave para os agentes de conteúdo
              </div>
              <BulletList items={keyMessages} icon={ChevronRight} />
            </div>
          )}
        </Section>
      )}

      {/* ── 4. Offer Positioning ── */}
      {(safeStr(offerPositioning["positioning"] as unknown) || safeStr(offerPositioning["priceJustification"] as unknown)) && (
        <Section icon={Target} title="Posicionamento da Oferta" color="cyan">
          <div className="space-y-4">
            {safeStr(offerPositioning["positioning"] as unknown) && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Posicionamento</div>
                <TextBlock text={safeStr(offerPositioning["positioning"] as unknown)} />
              </div>
            )}
            {safeStr(offerPositioning["priceJustification"] as unknown) && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Justificativa de preço</div>
                <TextBlock text={safeStr(offerPositioning["priceJustification"] as unknown)} />
              </div>
            )}
            {safeStr(offerPositioning["mainDifferential"] as unknown) && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Diferencial principal</div>
                <TextBlock text={safeStr(offerPositioning["mainDifferential"] as unknown)} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 5. Audience ── */}
      <Section icon={Users} title="Público-Alvo" color="primary">
        <div className="space-y-4">
          {safeStr(primaryAvatar["name"] as unknown) && (
            <div className="border border-border/40 p-3 bg-card/40">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Avatar primário</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {safeStr(primaryAvatar["name"] as unknown) && <div><span className="text-muted-foreground">Nome: </span>{safeStr(primaryAvatar["name"] as unknown)}</div>}
                {safeStr(primaryAvatar["age"] as unknown) && <div><span className="text-muted-foreground">Idade: </span>{safeStr(primaryAvatar["age"] as unknown)}</div>}
                {safeStr(primaryAvatar["occupation"] as unknown) && <div><span className="text-muted-foreground">Profissão: </span>{safeStr(primaryAvatar["occupation"] as unknown)}</div>}
                {safeStr(primaryAvatar["awarenessLevel"] as unknown) && <div><span className="text-muted-foreground">Consciência: </span>{safeStr(primaryAvatar["awarenessLevel"] as unknown)}</div>}
              </div>
              {safeStr(primaryAvatar["deepestDesire"] as unknown) && (
                <div className="mt-2 text-xs font-mono">
                  <span className="text-muted-foreground">Desejo profundo: </span>
                  <span className="text-foreground">{safeStr(primaryAvatar["deepestDesire"] as unknown)}</span>
                </div>
              )}
              {safeArr(primaryAvatar["dailyPains"] as unknown).length > 0 && (
                <div className="mt-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Dores identificadas</div>
                  <BulletList items={safeArr(primaryAvatar["dailyPains"] as unknown)} icon={AlertTriangle} color="text-yellow-400" />
                </div>
              )}
              {safeArr(primaryAvatar["typicalObjections"] as unknown).length > 0 && (
                <div className="mt-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Objeções típicas</div>
                  <BulletList items={safeArr(primaryAvatar["typicalObjections"] as unknown)} icon={MessageSquare} color="text-cyan-400" />
                </div>
              )}
              {safeArr(primaryAvatar["buyingTriggers"] as unknown).length > 0 && (
                <div className="mt-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">O que os faz comprar</div>
                  <BulletList items={safeArr(primaryAvatar["buyingTriggers"] as unknown)} icon={CheckCircle2} color="text-green-400" />
                </div>
              )}
            </div>
          )}

          {/* Segmentation strategy */}
          {objections.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Objeções reais vs. disfarçadas (estratégia de segmentação)
              </div>
              <BulletList items={objections} icon={Brain} color="text-violet-400" />
            </div>
          )}

          {/* Critical insights */}
          {criticalInsights.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Insights críticos do perfil
              </div>
              <BulletList items={criticalInsights} icon={Sparkles} color="text-yellow-400" />
            </div>
          )}

          {/* Segments */}
          {segments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <div className="w-full font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Segmentos detectados</div>
              {segments.map((seg, i) => (
                <Badge key={i} variant="outline" className="font-mono text-[10px] rounded-none border-border/40">
                  {seg}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── 6. Market Diagnosis ── */}
      {(threats.length > 0 || entryBarriers.length > 0) && (
        <Section icon={BarChart3} title="Diagnóstico de Mercado" color="primary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entryBarriers.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Barreiras de entrada / objeções de mercado
                </div>
                <BulletList items={entryBarriers} icon={AlertTriangle} color="text-yellow-400" />
              </div>
            )}
            {threats.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Ameaças identificadas
                </div>
                <BulletList items={threats} icon={AlertTriangle} color="text-red-400" />
              </div>
            )}
            {safeStr(marketIntelligence["campaignApproach"] as unknown) && (
              <div className="md:col-span-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Abordagem de campanha recomendada
                </div>
                <TextBlock text={safeStr(marketIntelligence["campaignApproach"] as unknown)} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 7. Mental Triggers ── */}
      {mentalTriggers.length > 0 && (
        <Section icon={Brain} title="Gatilhos Mentais Selecionados" badge={`${mentalTriggers.length} gatilhos`} color="cyan">
          <div className="flex flex-wrap gap-2 mb-3">
            {mentalTriggers.map((trigger, i) => {
              const t = TRIGGER_LABELS[trigger] ?? { label: trigger, color: "border-primary/40 text-primary" };
              return (
                <Badge key={i} variant="outline" className={`font-mono text-[11px] px-3 py-1 rounded-none ${t.color}`}>
                  {t.label}
                </Badge>
              );
            })}
          </div>
          {scarcityMechanism && (
            <div className="mt-3 p-3 border border-orange-400/20 bg-orange-400/5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-orange-400/70 mb-1">Mecanismo de escassez</div>
              <TextBlock text={scarcityMechanism} />
            </div>
          )}
        </Section>
      )}

      {/* ── 8. Launch Timeline ── */}
      <Section icon={Calendar} title="Cronograma do Lançamento" color="primary">
        <div className="space-y-3">
          {totalDays > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="border border-border/40 p-3 text-center">
                <div className="font-mono text-xl font-bold text-primary">{totalDays}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Dias total</div>
              </div>
              <div className="border border-border/40 p-3 text-center">
                <div className="font-mono text-xl font-bold text-cyan-400">{totalDays - conversionDays}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Aquecimento</div>
              </div>
              <div className="border border-border/40 p-3 text-center">
                <div className="font-mono text-xl font-bold text-green-400">{conversionDays}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Carrinho aberto</div>
              </div>
            </div>
          )}

          {phases.length > 0 ? (
            <div className="space-y-2">
              {(phases as Record<string, unknown>[]).map((phase, i) => (
                <div key={i} className="flex items-start gap-3 border border-border/30 p-3 bg-card/20">
                  <div className="font-mono text-[10px] text-primary/70 shrink-0 w-8 text-center mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {safeStr(phase["name"] as unknown)}
                      </span>
                      {safeStr(phase["duration"] as unknown) && (
                        <Badge variant="outline" className="font-mono text-[9px] px-1.5 rounded-none border-border/40">
                          {safeStr(phase["duration"] as unknown)}
                        </Badge>
                      )}
                    </div>
                    {safeStr(phase["objective"] as unknown) && (
                      <p className="font-mono text-[11px] text-foreground/70">{safeStr(phase["objective"] as unknown)}</p>
                    )}
                    {safeStr(phase["keyActivity"] as unknown) && (
                      <p className="font-mono text-[10px] text-muted-foreground mt-1">{safeStr(phase["keyActivity"] as unknown)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {launchNarrative && <TextBlock text={launchNarrative.slice(0, 600) + (launchNarrative.length > 600 ? "…" : "")} />}
              {!launchNarrative && totalDays > 0 && (
                <div className="space-y-2">
                  <div className="border-l-2 border-cyan-400/50 pl-3 py-1">
                    <div className="font-mono text-xs font-bold text-foreground">Fase 1 — Aquecimento</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{totalDays - conversionDays} dias · Construção de audiência e geração de leads qualificados</div>
                  </div>
                  <div className="border-l-2 border-yellow-400/50 pl-3 py-1">
                    <div className="font-mono text-xs font-bold text-foreground">Fase 2 — Abertura do Carrinho</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{conversionDays} dias · Conversão com sequência de nurturing e urgência progressiva</div>
                  </div>
                  <div className="border-l-2 border-orange-400/50 pl-3 py-1">
                    <div className="font-mono text-xs font-bold text-foreground">Fase 3 — Fechamento</div>
                    <div className="font-mono text-[11px] text-muted-foreground">Último dia · Sequência de escassez, last call e encerramento</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {safeStr(timelineD["launchManagerNotes"] as unknown ?? timelineRaw["launchManagerNotes"] as unknown) && (
            <div className="p-3 border border-border/30 bg-muted/10 mt-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Notas do Gerente de Lançamento</div>
              <TextBlock text={safeStr(timelineD["launchManagerNotes"] as unknown ?? timelineRaw["launchManagerNotes"] as unknown)} />
            </div>
          )}
        </div>
      </Section>

      {/* ── 9. Financial Projection ── */}
      {(scenarios.length > 0 || Object.keys(keyMetrics).length > 0 || Object.keys(campaignSummary).length > 0) && (
        <Section icon={TrendingUp} title="Projeção Financeira" color="green">
          <div className="space-y-4">
            {Boolean(campaignSummary["totalBudget"] || campaignSummary["expectedRevenue"]) && (
              <div className="grid grid-cols-2 gap-3">
                {Boolean(campaignSummary["totalBudget"]) && (
                  <div className="border border-border/40 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Budget total</div>
                    <div className="font-mono text-lg font-bold text-foreground">
                      {Number(campaignSummary["totalBudget"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
                {Boolean(campaignSummary["expectedRevenue"]) && (
                  <div className="border border-green-400/20 p-3 bg-green-400/5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-green-400/70">Receita esperada</div>
                    <div className="font-mono text-lg font-bold text-green-400">
                      {Number(campaignSummary["expectedRevenue"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {scenarios.length > 0 && (
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Cenários de projeção</div>
                {scenarios.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between border border-border/30 px-4 py-2.5 bg-card/20">
                    <span className="font-mono text-xs text-foreground">{safeStr(sc["name"] as unknown) || `Cenário ${i + 1}`}</span>
                    <div className="text-right">
                      {Boolean(sc["revenue"]) && (
                        <span className="font-mono text-sm font-bold text-green-400">
                          {Number(sc["revenue"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                        </span>
                      )}
                      {Boolean(sc["roas"]) && (
                        <span className="font-mono text-[11px] text-muted-foreground ml-2">ROAS {Number(sc["roas"]).toFixed(1)}x</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(keyMetrics["breakEvenRevenue"] || keyMetrics["totalLeadsNeeded"]) ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {keyMetrics["breakEvenRevenue"] ? (
                  <div className="border border-border/30 p-2 text-center">
                    <div className="font-mono text-xs font-bold text-foreground">
                      {Number(keyMetrics["breakEvenRevenue"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground uppercase">Break-even</div>
                  </div>
                ) : null}
                {keyMetrics["totalLeadsNeeded"] ? (
                  <div className="border border-border/30 p-2 text-center">
                    <div className="font-mono text-xs font-bold text-foreground">
                      {Number(keyMetrics["totalLeadsNeeded"]).toLocaleString("pt-BR")}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground uppercase">Leads necessários</div>
                  </div>
                ) : null}
                {keyMetrics["averageCPLTarget"] ? (
                  <div className="border border-border/30 p-2 text-center">
                    <div className="font-mono text-xs font-bold text-foreground">
                      {Number(keyMetrics["averageCPLTarget"]).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground uppercase">CPL alvo</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {riskAlerts.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Alertas financeiros</div>
                <BulletList items={riskAlerts} icon={AlertTriangle} color="text-yellow-400" />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 10. Success Metrics ── */}
      {Object.keys(successMetrics).length > 0 && (
        <Section icon={CheckCircle2} title="Métricas de Sucesso" color="green">
          <div className="space-y-3">
            {safeStr(successMetrics["primaryKPI"] as unknown) && (
              <div className="p-3 border border-green-400/20 bg-green-400/5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-green-400/70 mb-1">KPI Principal</div>
                <TextBlock text={safeStr(successMetrics["primaryKPI"] as unknown)} />
              </div>
            )}
            {criticalAssumptions.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Premissas críticas para atingir a meta
                </div>
                <BulletList items={criticalAssumptions} icon={CheckCircle2} color="text-green-400" />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 11. Risks ── */}
      {mainRisks.length > 0 && (
        <Section icon={AlertTriangle} title="Análise de Risco" badge={riskLevel ? `Risco ${riskLevel}` : undefined} color="red">
          <BulletList items={mainRisks} icon={AlertTriangle} color="text-red-400" />
        </Section>
      )}

      {/* ── 12. Strategist notes ── */}
      {safeStr(strategyD["strategistNotes"] as unknown) && (
        <Section icon={Brain} title="Observações do Estrategista" color="yellow">
          <TextBlock text={safeStr(strategyD["strategistNotes"] as unknown)} />
        </Section>
      )}

      {/* ── CTA: Approve & Generate Content ── */}
      {showApproveButton && onApprove && (
        <div className="border border-primary/40 bg-primary/5 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-primary mb-1">Próximo passo</div>
            <p className="font-mono text-sm text-foreground">
              Estratégia aprovada? Inicie a geração de conteúdo com os 16 agentes de IA.
            </p>
            <p className="font-mono text-[11px] text-muted-foreground mt-1">
              Custo estimado: ~150 créditos ({creditsToReal(150)}) para a fase de conteúdo
            </p>
          </div>
          <Button
            onClick={onApprove}
            disabled={approveLoading}
            className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary shrink-0"
          >
            {approveLoading ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Aprovar e Gerar Conteúdo
          </Button>
        </div>
      )}
    </div>
  );
}
